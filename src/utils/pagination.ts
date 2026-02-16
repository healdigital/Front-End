export function getPageNumbers(current: number, total: number): (number | string)[] {
    // If total pages is small, just show all
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const delta = 1;

    // Range start/end
    let rangeStart = Math.max(2, current - delta);
    let rangeEnd = Math.min(total - 1, current + delta);

    if (current <= 3) {
        rangeEnd = Math.max(rangeEnd, 4); // ensure we show at least 1,2,3,4...
        rangeStart = 2;
    }

    if (current >= total - 2) {
        rangeStart = Math.min(rangeStart, total - 3);
        rangeEnd = total - 1;
    }

    const items: (number | string)[] = [1];

    if (rangeStart > 2) {
        items.push('...');
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
        items.push(i);
    }

    if (rangeEnd < total - 1) {
        items.push('...');
    }

    if (total > 1) {
        items.push(total);
    }

    return items;
}
