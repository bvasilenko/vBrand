// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const STRIPE_CANDIDATE = {
  sourceUri: 'https://stripe.com',
  fields: {
    name:             { confidence: 'medium', value: 'Stripe',               source: 'og:title' },
    voiceCanonical:   { confidence: 'high',   value: 'Stripe | Financial Infrastructure to Grow Your Revenue', source: 'og:title' },
    voiceDescription: { confidence: 'high',   value: 'Stripe is a financial services platform that helps all types of businesses accept payments, build flexible billing models, and manage money movement.', source: 'og:description' },
    colors:           { confidence: 'none',   value: null, reason: 'dynamic-render-required' },
    favicon:          { confidence: 'high',   value: { source: 'vbrand/.cache/stripe-com/favicon.svg', sizes: [16,32,180,512] }, source: 'link[rel=icon]' },
    og:               { confidence: 'high',   value: { dimensions: [1200, 630] }, source: 'default' },
    typeTokens:       { confidence: 'none',   value: null, reason: 'absent-in-source' },
    marks:            { confidence: 'none',   value: null, reason: 'absent-in-source' },
    themes:           { confidence: 'none',   value: null, reason: 'absent-in-source' },
    illustration:     { confidence: 'none',   value: null, reason: 'absent-in-source' },
    slots:            { confidence: 'none',   value: null, reason: 'absent-in-source' },
    fusePolicies:     { confidence: 'none',   value: null, reason: 'absent-in-source' },
    icons:            { confidence: 'none',   value: null, reason: 'absent-in-source' },
  },
};

const WEB_EXTRACTABLE = ['name', 'voiceCanonical', 'voiceDescription', 'colors', 'favicon', 'og', 'icons'];
const DONOR_SPEC_DEEP  = ['typeTokens', 'marks', 'themes', 'illustration', 'slots', 'fusePolicies'];

const CONFIDENCE_COLOR = { high: '#22c55e', medium: '#eab308', low: '#f97316', none: '#ef4444' };
const CONFIDENCE_BG    = { high: '#f0fdf4', medium: '#fefce8', low: '#fff7ed', none: '#fef2f2' };

function Badge({ level }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 1,
      color: '#fff', background: CONFIDENCE_COLOR[level] ?? '#6b7280',
    }}>
      {level.toUpperCase()}
    </span>
  );
}

function FieldRow({ name, field }) {
  const displayValue = field.value === null
    ? <em style={{ color: '#9ca3af' }}>–</em>
    : typeof field.value === 'object'
      ? <code style={{ fontSize: 11 }}>{JSON.stringify(field.value)}</code>
      : <span style={{ wordBreak: 'break-word' }}>{String(field.value)}</span>;

  return (
    <tr style={{ background: CONFIDENCE_BG[field.confidence] ?? '#fff', borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'nowrap' }}>{name}</td>
      <td style={{ padding: '8px 12px' }}><Badge level={field.confidence} /></td>
      <td style={{ padding: '8px 12px', fontSize: 13, maxWidth: 420 }}>{displayValue}</td>
      <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>{field.source ?? field.reason ?? ''}</td>
    </tr>
  );
}

function FieldGroup({ title, subtitle, fieldNames, fields }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{subtitle}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>Field</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>Confidence</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>Value</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {fieldNames.map(name => (
            <FieldRow key={name} name={name} field={fields[name]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const { fields, sourceUri } = STRIPE_CANDIDATE;
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>vBrand 0.2.1 Demo</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 32 }}>
        Pull result for <code>{sourceUri}</code>. Fixture replay.
      </p>

      <FieldGroup
        title="Web-extractable fields"
        subtitle="Populated by vbrand pull from public HTML, og: meta, JSON-LD, and inline CSS vars."
        fieldNames={WEB_EXTRACTABLE}
        fields={fields}
      />

      <FieldGroup
        title="Donor-spec deep fields"
        subtitle="Populated from local fixture or DTCG bundle — not exposed by any website via meta tags."
        fieldNames={DONOR_SPEC_DEEP}
        fields={fields}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
