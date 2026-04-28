#!/usr/bin/env python3
"""
Export WordPress articles + WPRM recipe content over SSH into one JSON file.

Usage example:
  python scripts/export-wp-content-via-ssh.py \
    --host ssh.stagingapp15670.cloudwayssites.com \
    --port 2240 \
    --user admin \
    --password "YOUR_PASSWORD" \
    --wp-path /var/www/html/public_html \
    --output .tmp/wp_full_export.json \
    --post-types post,wprm_recipe

Environment variable fallbacks:
  WP_SSH_HOST, WP_SSH_PORT, WP_SSH_USER, WP_SSH_PASS (or WP_SSH_PASSWORD), WP_SSH_WP_PATH
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import posixpath
import shlex
import sys
from pathlib import Path

import paramiko


REMOTE_EXPORTER = r"""<?php
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This exporter must run in CLI mode.\n");
    exit(1);
}

@ini_set('memory_limit', '-1');
@set_time_limit(0);

$opts = getopt('', [
    'wp-path:',
    'output:',
    'post-types::',
    'limit::',
    'include-wprm-tables::',
]);

$wpPath = isset($opts['wp-path']) ? rtrim($opts['wp-path'], '/') : '';
$output = isset($opts['output']) ? $opts['output'] : '';
$postTypes = isset($opts['post-types']) && strlen($opts['post-types']) > 0
    ? array_values(array_filter(array_map('trim', explode(',', $opts['post-types']))))
    : ['post', 'wprm_recipe'];
$limit = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$includeWprmTables = isset($opts['include-wprm-tables']) ? (int)$opts['include-wprm-tables'] : 1;

if ($wpPath === '' || !is_dir($wpPath)) {
    fwrite(STDERR, "Invalid --wp-path: {$wpPath}\n");
    exit(2);
}
if ($output === '') {
    fwrite(STDERR, "Missing --output\n");
    exit(2);
}

$wpLoad = $wpPath . '/wp-load.php';
if (!file_exists($wpLoad)) {
    fwrite(STDERR, "wp-load.php not found at: {$wpLoad}\n");
    exit(2);
}

require_once $wpLoad;

if (!function_exists('get_post')) {
    fwrite(STDERR, "WordPress bootstrap failed.\n");
    exit(3);
}

global $wpdb;

function deep_unserialize_value($value) {
    if (is_string($value)) {
        $decoded = maybe_unserialize($value);
        if ($decoded !== $value) {
            return deep_unserialize_value($decoded);
        }
        return $value;
    }
    if (is_array($value)) {
        $result = [];
        foreach ($value as $k => $v) {
            $result[$k] = deep_unserialize_value($v);
        }
        return $result;
    }
    if (is_object($value)) {
        $result = [];
        foreach (get_object_vars($value) as $k => $v) {
            $result[$k] = deep_unserialize_value($v);
        }
        return $result;
    }
    return $value;
}

function normalize_meta_for_post($postId) {
    $raw = get_post_meta($postId);
    $out = [];
    foreach ($raw as $key => $values) {
        $normalized = [];
        if (is_array($values)) {
            foreach ($values as $v) {
                $normalized[] = deep_unserialize_value($v);
            }
        }
        $out[$key] = $normalized;
    }
    return $out;
}

function normalize_terms_for_post($postId, $postType) {
    $taxonomies = get_object_taxonomies($postType, 'names');
    $result = [];
    if (!is_array($taxonomies)) {
        return $result;
    }
    foreach ($taxonomies as $taxonomy) {
        $terms = wp_get_post_terms($postId, $taxonomy);
        if (is_wp_error($terms)) {
            $result[$taxonomy] = [
                '_error' => $terms->get_error_message(),
            ];
            continue;
        }
        $bucket = [];
        foreach ($terms as $term) {
            $bucket[] = [
                'term_id' => (int)$term->term_id,
                'name' => (string)$term->name,
                'slug' => (string)$term->slug,
                'taxonomy' => (string)$term->taxonomy,
                'parent' => (int)$term->parent,
                'count' => (int)$term->count,
            ];
        }
        $result[$taxonomy] = $bucket;
    }
    return $result;
}

function normalize_featured_for_post($postId) {
    $thumbId = (int)get_post_thumbnail_id($postId);
    if (!$thumbId) {
        return null;
    }
    return [
        'id' => $thumbId,
        'url' => (string)(wp_get_attachment_url($thumbId) ?: ''),
        'alt' => (string)(get_post_meta($thumbId, '_wp_attachment_image_alt', true) ?: ''),
        'title' => (string)(get_the_title($thumbId) ?: ''),
    ];
}

function normalize_author_for_post($postAuthorId) {
    $authorId = (int)$postAuthorId;
    if (!$authorId) {
        return null;
    }
    $user = get_userdata($authorId);
    if (!$user) {
        return ['id' => $authorId];
    }
    return [
        'id' => $authorId,
        'user_login' => (string)$user->user_login,
        'display_name' => (string)$user->display_name,
        'user_email' => (string)$user->user_email,
        'roles' => array_values((array)$user->roles),
    ];
}

function json_encode_safe($value) {
    return json_encode(
        $value,
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_INVALID_UTF8_SUBSTITUTE
        | JSON_PARTIAL_OUTPUT_ON_ERROR
    );
}

$fh = fopen($output, 'wb');
if (!$fh) {
    fwrite(STDERR, "Cannot open output file: {$output}\n");
    exit(4);
}

$header = [
    'generatedAt' => gmdate('c'),
    'siteUrl' => (string)get_site_url(),
    'homeUrl' => (string)home_url('/'),
    'wpVersion' => (string)get_bloginfo('version'),
    'postTypesRequested' => $postTypes,
    'limit' => $limit,
    'includeWprmTables' => (bool)$includeWprmTables,
];

fwrite($fh, "{\n");
fwrite($fh, '  "meta": ' . json_encode_safe($header) . ",\n");
fwrite($fh, '  "posts": [' . "\n");

$placeholder = implode(',', array_fill(0, count($postTypes), '%s'));
$queryBase = "SELECT ID FROM {$wpdb->posts} WHERE post_type IN ({$placeholder}) AND post_status NOT IN ('auto-draft','trash') ORDER BY ID ASC";
$prepared = $wpdb->prepare($queryBase, ...$postTypes);
if ($limit > 0) {
    $prepared .= ' LIMIT ' . (int)$limit;
}
$postIds = $wpdb->get_col($prepared);

$postCount = 0;
$firstPost = true;

if (is_array($postIds)) {
    foreach ($postIds as $id) {
        $postId = (int)$id;
        $postObj = get_post($postId, ARRAY_A);
        if (!is_array($postObj)) {
            continue;
        }
        $postType = (string)$postObj['post_type'];

        $record = [
            'id' => $postId,
            'post' => deep_unserialize_value($postObj),
            'permalink' => (string)(get_permalink($postId) ?: ''),
            'featured' => normalize_featured_for_post($postId),
            'author' => normalize_author_for_post($postObj['post_author']),
            'terms' => normalize_terms_for_post($postId, $postType),
            'meta' => normalize_meta_for_post($postId),
        ];

        if (!$firstPost) {
            fwrite($fh, ",\n");
        }
        $firstPost = false;
        fwrite($fh, '    ' . json_encode_safe($record));
        $postCount++;
    }
}

fwrite($fh, "\n  ],\n");
fwrite($fh, '  "wprmTables": {' . "\n");

$firstTable = true;
$tableCount = 0;

if ($includeWprmTables) {
    $likePattern = $wpdb->esc_like($wpdb->prefix . 'wprm_') . '%';
    $tables = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $likePattern));

    if (is_array($tables)) {
        foreach ($tables as $table) {
            $tableName = (string)$table;
            if ($tableName === '') {
                continue;
            }

            if (!$firstTable) {
                fwrite($fh, ",\n");
            }
            $firstTable = false;
            $tableCount++;

            fwrite($fh, '    ' . json_encode_safe($tableName) . ': [' . "\n");

            $chunkSize = 500;
            $offset = 0;
            $firstRow = true;
            while (true) {
                $chunkSql = $wpdb->prepare("SELECT * FROM `{$tableName}` LIMIT %d OFFSET %d", $chunkSize, $offset);
                $rows = $wpdb->get_results($chunkSql, ARRAY_A);
                if (!is_array($rows) || count($rows) === 0) {
                    break;
                }
                foreach ($rows as $row) {
                    if (!$firstRow) {
                        fwrite($fh, ",\n");
                    }
                    $firstRow = false;
                    fwrite($fh, '      ' . json_encode_safe(deep_unserialize_value($row)));
                }
                $offset += count($rows);
            }

            fwrite($fh, "\n    ]");
        }
    }
}

fwrite($fh, "\n  },\n");
fwrite($fh, '  "counts": ' . json_encode_safe([
    'posts' => $postCount,
    'wprmTables' => $tableCount,
]) . "\n");
fwrite($fh, "}\n");

fclose($fh);

fwrite(STDERR, "Export complete. posts={$postCount}, wprm_tables={$tableCount}, file={$output}\n");
exit(0);
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export WordPress + WPRM content over SSH to local JSON.",
    )
    parser.add_argument("--host", default=os.getenv("WP_SSH_HOST", ""), help="SSH host")
    parser.add_argument("--port", type=int, default=int(os.getenv("WP_SSH_PORT", "22")), help="SSH port")
    parser.add_argument("--user", default=os.getenv("WP_SSH_USER", ""), help="SSH username")
    parser.add_argument(
        "--password",
        default=os.getenv("WP_SSH_PASS", os.getenv("WP_SSH_PASSWORD", "")),
        help="SSH password",
    )
    parser.add_argument(
        "--wp-path",
        default=os.getenv("WP_SSH_WP_PATH", "/var/www/html/public_html"),
        help="Remote WordPress root path (contains wp-load.php)",
    )
    parser.add_argument(
        "--output",
        default=f".tmp/wp_full_export_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        help="Local output JSON path",
    )
    parser.add_argument(
        "--post-types",
        default="post,wprm_recipe",
        help="Comma-separated post types to export",
    )
    parser.add_argument("--limit", type=int, default=0, help="Limit number of posts (0 = all)")
    parser.add_argument(
        "--include-wprm-tables",
        type=int,
        default=1,
        choices=[0, 1],
        help="Also export wp_wprm_* tables (1/0)",
    )
    parser.add_argument(
        "--keep-remote-files",
        action="store_true",
        help="Keep temporary exporter/output files on remote server",
    )
    return parser.parse_args()


def require_args(args: argparse.Namespace) -> None:
    missing = []
    if not args.host:
        missing.append("--host / WP_SSH_HOST")
    if not args.user:
        missing.append("--user / WP_SSH_USER")
    if not args.password:
        missing.append("--password / WP_SSH_PASS")
    if missing:
        raise SystemExit("Missing required SSH values: " + ", ".join(missing))


def main() -> int:
    args = parse_args()
    require_args(args)

    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    remote_php = f"/tmp/wp_export_{stamp}.php"
    remote_json = f"/tmp/wp_export_{stamp}.json"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"[SSH] Connecting to {args.user}@{args.host}:{args.port} ...")
        client.connect(
            hostname=args.host,
            port=args.port,
            username=args.user,
            password=args.password,
            timeout=25,
        )

        sftp = client.open_sftp()
        print(f"[SSH] Uploading exporter -> {remote_php}")
        with sftp.open(remote_php, "w") as f:
            f.write(REMOTE_EXPORTER)
        sftp.chmod(remote_php, 0o700)

        cmd = (
            f"php {shlex.quote(remote_php)} "
            f"--wp-path={shlex.quote(args.wp_path)} "
            f"--output={shlex.quote(remote_json)} "
            f"--post-types={shlex.quote(args.post_types)} "
            f"--limit={int(args.limit)} "
            f"--include-wprm-tables={int(args.include_wprm_tables)}"
        )

        print("[SSH] Running remote export ...")
        _, stdout, stderr = client.exec_command(cmd, get_pty=True)

        # Stream stderr (progress / errors).
        while True:
            line = stderr.readline()
            if not line:
                break
            sys.stdout.write(line)
            sys.stdout.flush()

        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            raise RuntimeError(f"Remote exporter failed with exit code {exit_code}")

        print(f"[SSH] Downloading export -> {output_path}")
        sftp.get(remote_json, str(output_path))

        if not args.keep_remote_files:
            for remote_file in (remote_php, remote_json):
                try:
                    sftp.remove(remote_file)
                except Exception:
                    pass

        sftp.close()
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"[DONE] Export saved: {output_path} ({size_mb:.2f} MB)")
        return 0

    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())

