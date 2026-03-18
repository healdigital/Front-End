import React from 'react';
import type { FieldType } from 'payload/dist/fields/config/types';

// This field renders raw HTML content in a read-only preview.
// It is intended to show legacy HTML in the admin rather than raw markup.

const HtmlPreview: React.FC<FieldType> = ({ value }) => {
  const html = typeof value === 'string' ? value : '';

  return (
    <div
      style={{
        padding: '0.75rem',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '0.5rem',
        background: 'white',
        maxHeight: '550px',
        overflow: 'auto',
        whiteSpace: 'normal',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default HtmlPreview;
