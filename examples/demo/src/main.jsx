// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@booga/vui/styles.css';
import './brand-tokens.css';
import { App } from './app';

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
