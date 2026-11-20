// ==UserScript==
// @name        GoPro Cloud Toolkit
// @description Bulk-manage your GoPro cloud library: live filters, stats, metadata export, download links, bulk download, duplicate finder and delete. Unofficial; dry run built in.
// @version     1.4.0
// @author      GuerraSa
// @homepageURL https://github.com/GuerraSa/gopro-toolkit
// @supportURL  https://github.com/GuerraSa/gopro-toolkit/issues
// @updateURL   https://github.com/GuerraSa/gopro-toolkit/releases/latest/download/gopro-toolkit.user.js
// @downloadURL https://github.com/GuerraSa/gopro-toolkit/releases/latest/download/gopro-toolkit.user.js
// @match       https://gopro.com/*
// @match       https://*.gopro.com/*
// @exclude     https://api.gopro.com/*
// @exclude     https://images-*.gopro.com/*
// @license     MIT
// @namespace   local.gopro-cloud-toolkit
// @run-at      document-idle
// @noframes
// @grant       GM_registerMenuCommand
// @grant       GM_xmlhttpRequest
// @grant       GM_download
// @grant       unsafeWindow
// @connect     api.gopro.com
// @connect     *
// ==/UserScript==
//
// UNOFFICIAL. This talks to the same private web API that gopro.com uses once you are signed in.
// GoPro can change it at any time, and automated use may be against GoPro's terms. Use at your own risk.
//
// HOW IT WORKS
//   1. Load library   : pages through GET api.gopro.com/media/search (metadata only, no files are moved)
//   2. Filter         : everything is filtered locally, so the match count updates instantly
//   3. Action         : stats / export / links / download / delete
// Tick "Dry run" to list what an action WOULD do without doing it.
(function () {
  'use strict';

  const VERSION = '1.4.0';
  const API = 'https://api.gopro.com';
  const ACCEPT_SEARCH = 'application/vnd.gopro.jk.media.search+json; version=2.0.0';
  const ACCEPT_MEDIA = 'application/vnd.gopro.jk.media+json; version=2.0.0';
  const SEARCH_FIELDS = 'camera_model,captured_at,content_title,content_type,created_at,gopro_user_id,gopro_media,filename,file_extension,file_size,height,fov,id,item_count,mce_type,moments_count,on_public_profile,orientation,play_as,ready_to_edit,ready_to_view,resolution,source_duration,token,type,width,submitted_at,thumbnail_available,captured_at_timezone,available_labels';
  const MEDIA_TYPES = ['Video', 'Photo', 'Burst', 'BurstVideo', 'Continuous', 'LoopedVideo', 'TimeLapse', 'TimeLapseVideo', 'MultiClipEdit'];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 10000;

  const css = (`
:root {
    --accent: #3b82f6; --accent-hover: #60a5fa; --accent-muted: rgba(59, 130, 246, 0.15); --accent-glow: rgba(59, 130, 246, 0.25); --bg-base: #0c0c0e; --bg-raised: #111114; --bg-overlay: #161619; --bg-surface: #1c1c20; --bg-surface-hover: #242429; --bg-surface-active: #2a2a30; --border-subtle: rgba(255, 255, 255, 0.06); --border-default: rgba(255, 255, 255, 0.09); --border-strong: rgba(255, 255, 255, 0.14); --text-primary: #e4e4e8; --text-secondary: #9a9aa5; --text-tertiary: #65656f; --text-disabled: #45454d; --danger: #ef4444; --danger-muted: rgba(239, 68, 68, 0.12); --danger-hover: #f87171; --success: #34d399; --warning-text: #fbbf24; --overlay-filter: blur(12px) brightness(0.3) saturate(0.8); --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --ease: cubic-bezier(0.4, 0, 0.2, 1); --duration-fast: 0.12s; --duration: 0.2s; --shadow-panel: 0 24px 80px rgba(0, 0, 0, 0.6),
                     0 0 0 1px var(--border-subtle); }
.overlay { position: fixed; display: none; left: 0; top: 0; width: 100%; height: 100%; z-index: 499; backdrop-filter: var(--overlay-filter); -webkit-backdrop-filter: var(--overlay-filter); transition: opacity var(--duration) var(--ease); }
@media only screen and (min-width: 700px) { .window-body { display: grid; grid-template-columns: 300px 1fr; }
}
@media only screen and (max-width: 700px) { .window-body { display: flex; flex-direction: column; }
    #gptk { top: 0% !important; bottom: 0% !important; width: 100% !important; border-radius: 0 !important; .header-steps { display: none; }
        .sidebar { flex: 1 1 0; min-height: 0; border-right: none; }
        .main { flex: 0 0 auto; height: auto !important; max-height: 40vh !important; border-top: 1px solid var(--border-subtle); }
        #logArea { max-height: 20vh; }
    }
}
#gptk { position: fixed; top: 4%; left: 50%; transform: translateX(-50%); width: 92%; bottom: 4%; min-height: 300px; max-width: 1280px; min-width: 300px; z-index: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-size: 13px; line-height: 1.4; padding: 0; display: none; flex-direction: column; cursor: default; border-radius: var(--radius-xl); color-scheme: dark; background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-panel); box-sizing: border-box; overflow: hidden; * { box-sizing: border-box; }
    .flex { display: flex; }
    .centered { align-items: center; }
    .grid { display: grid; }
    .columns { gap: 1px; margin-bottom: 1px; grid-auto-flow: column; }
    hr { border: none; margin: 0; width: 100%; border-bottom: 1px solid var(--border-subtle); }
    button { background-color: var(--bg-surface); color: var(--text-primary); cursor: pointer; border: 1px solid var(--border-default); align-items: center; display: inline-flex; gap: 5px; padding: 0 10px; border-radius: var(--radius-sm); height: 28px; font-size: 11.5px; font-weight: 500; letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap; transition: all var(--duration-fast) var(--ease); font-family: inherit; svg { flex-shrink: 0; fill: currentColor; }
    }
    button:not(:disabled):not(.not-applicable):hover { background-color: var(--bg-surface-hover); border-color: var(--border-strong); }
    button:not(:disabled):not(.not-applicable):active { background-color: var(--bg-surface-active); transform: scale(0.97); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    button:disabled, button.not-applicable { background-color: var(--bg-raised); color: var(--text-disabled); border-color: transparent; cursor: not-allowed; opacity: 0.5; svg { opacity: 0.4; }
    }
    button.btn-primary { background-color: var(--accent); border-color: transparent; color: #fff; }
    button.btn-primary:not(:disabled):hover { background-color: var(--accent-hover); }
    legend, label { font-size: 12px; line-height: 16px; font-weight: 500; }
    input[type="text"],
    input[type="input"],
    input[type="number"],
    input[type="datetime-local"] { background-color: var(--bg-raised); color: var(--text-primary); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 5px 10px; font-size: 12.5px; font-family: inherit; height: 30px; transition: border-color var(--duration-fast) var(--ease),
                    box-shadow var(--duration-fast) var(--ease); width: 100%; }
    input[type="text"]:focus,
    input[type="input"]:focus,
    input[type="number"]:focus,
    input[type="datetime-local"]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    input[type="text"]::placeholder,
    input[type="input"]::placeholder,
    input[type="number"]::placeholder { color: var(--text-tertiary); }
    select { background-color: var(--bg-raised); color: var(--text-primary); border: 1px solid var(--border-default); border-radius: var(--radius-sm); font-size: 12px; font-family: inherit; transition: border-color var(--duration-fast) var(--ease); }
    select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    option.shared { background-color: rgba(59, 130, 246, 0.1); }
    option:checked { background-color: var(--accent); color: white; }
    .radio-group { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 2px 0; }
    .radio-group label,
    .checkbox-control { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 3px 0; font-size: 12px; color: var(--text-secondary); transition: color var(--duration-fast) var(--ease); }
    .radio-group label:hover,
    .checkbox-control:hover { color: var(--text-primary); }
    input[type="radio"],
    input[type="checkbox"] { accent-color: var(--accent); }
    .header { padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, transparent 50%); border-bottom: 1px solid var(--border-subtle); gap: 12px; flex-shrink: 0; .header-info { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .header-icon { color: var(--accent); display: flex; align-items: center; }
        .header-text { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); }
    }
    .header-steps { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-secondary); user-select: none; }
    .step-badge { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background-color: var(--accent); color: #fff; font-size: 11px; font-weight: 700; line-height: 1; flex-shrink: 0; }
    .step-arrow { color: var(--text-tertiary); font-size: 14px; font-weight: 400; }
    #hide { cursor: pointer; fill: var(--text-tertiary); display: flex; align-items: center; padding: 4px; border-radius: var(--radius-sm); transition: all var(--duration-fast) var(--ease); }
    #hide:hover { fill: var(--text-primary); background-color: var(--bg-surface-hover); }
    .panel-section { padding: 0; flex-shrink: 0; }
    .panel-section + .panel-section { border-top: 1px solid var(--border-subtle); padding-top: 2px; }
    .section-label { display: flex; align-items: center; gap: 8px; padding: 10px 4px 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); user-select: none; }
    .dry-run-toggle { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; font-weight: 600; color: var(--warning-text); text-transform: uppercase; letter-spacing: 0.03em; }
    .sources { gap: 3px; display: flex; flex-wrap: wrap; padding: 4px 0 8px; user-select: none; .sourceHeader { display: inline-flex; align-items: center; gap: 5px; fill: var(--text-tertiary); color: var(--text-secondary); cursor: pointer; font-weight: 600; font-size: 11.5px; letter-spacing: 0.03em; text-transform: uppercase; transition: all var(--duration) var(--ease); border-radius: var(--radius-md); padding: 6px 10px; svg { transition: fill var(--duration-fast) var(--ease); }
            span { line-height: 1; }
        }
        .source input { display: none; }
        input:disabled + .sourceHeader { cursor: not-allowed; color: var(--text-disabled); fill: var(--text-disabled); opacity: 0.4; }
        input:not(:disabled) + .sourceHeader:hover { fill: var(--text-primary); color: var(--text-primary); background-color: var(--bg-surface); }
        .source input:checked + .sourceHeader { background-color: var(--accent); fill: #fff; color: #fff; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1); }
    }
    .action-bar { display: flex; flex-direction: column; background-color: var(--bg-raised); user-select: none; border-bottom: 1px solid var(--border-subtle); min-height: 0; padding-top: 4px; .section-label { padding: 6px 12px 4px; }
        .action-buttons { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 12px 8px; align-items: flex-start; }
        .to-existing-container,
        .to-new-container { display: none; flex-wrap: wrap; gap: 6px; padding: 8px 12px; align-items: center; }
        .album-form { display: flex; gap: 6px; align-items: center; flex: 1; min-width: 0; }
        .album-form select { flex: 1; min-width: 120px; max-width: 400px; height: 30px; }
        .album-form input[type="text"] { flex: 1; min-width: 120px; max-width: 300px; }
        button.running { background-color: var(--accent); border-color: var(--accent); color: #fff; animation: pulse-running 2s infinite; opacity: 1; }
        svg { fill: currentColor; }
    }
    @keyframes pulse-running { 0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    .refresh-albums { cursor: pointer; fill: var(--text-secondary); background-color: var(--bg-surface); border-radius: var(--radius-sm); padding: 3px; border: 1px solid var(--border-default); transition: all var(--duration-fast) var(--ease); display: flex; justify-content: center; align-items: center; }
    .refresh-albums:hover { fill: var(--text-primary); background-color: var(--bg-surface-hover); }
    .svg-container { display: flex; justify-content: center; }
    .window-body { flex: 1 1 0; min-height: 0; overflow: hidden; }
    .sidebar { height: 100%; position: relative; display: flex; flex-direction: column; background-color: var(--bg-raised); overflow-y: auto; overflow-x: hidden; max-height: 100%; padding: 0 10px 10px 10px; border-right: 1px solid var(--border-subtle); form { width: 100%; }
        .filters-form { flex: 1 1 auto; }
        .settings-form { margin-bottom: 4px; flex-shrink: 0; summary { color: var(--text-tertiary); font-size: 12px; }
        }
        summary { font-size: 12.5px; font-weight: 600; line-height: 20px; position: relative; overflow: hidden; margin-bottom: 2px; padding: 7px 8px; cursor: pointer; white-space: nowrap; text-overflow: ellipsis; border-radius: var(--radius-sm); flex-shrink: 0; transition: all var(--duration-fast) var(--ease); color: var(--text-secondary); }
        summary:hover { background-color: var(--bg-surface); color: var(--text-primary); }
        summary::marker { color: var(--text-tertiary); }
        details[open] > summary { color: var(--text-primary); }
        details[open] > summary::marker { color: var(--accent); }
        details.filter-active > summary { color: var(--accent); background-color: var(--accent-muted); }
        details.filter-active > summary::marker { color: var(--accent); }
        fieldset.filter-active > label { color: var(--accent); }
        fieldset { flex-direction: column; margin: 0 4px 0 16px; padding: 0; border: 0; font-weight: inherit; font-style: inherit; font-family: inherit; font-size: 100%; vertical-align: baseline; }
        legend,
        label { display: block; width: 100%; margin-bottom: 4px; }
        .radio-group label { display: inline-flex; width: auto; }
        legend { margin-bottom: 3px; color: var(--text-tertiary); text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.05em; }
        select { width: 100%; }
        .select-control-buttons-row { display: flex; flex-wrap: wrap; height: auto; gap: 3px; margin-top: 4px; }
        .input-wrapper { margin-left: 0; margin-bottom: 8px; }
        #filterResetButton { width: 100%; fill: var(--text-tertiary); color: var(--text-tertiary); cursor: pointer; border-radius: var(--radius-sm); padding: 5px 8px; transition: all var(--duration-fast) var(--ease); gap: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        #filterResetButton:hover { fill: var(--text-primary); color: var(--text-primary); background-color: var(--bg-surface); }
        .form-control { cursor: pointer; }
        .filter-note { display: block; font-size: 11px; color: var(--text-tertiary); line-height: 1.4; margin-top: 2px; }
        .date-reset { cursor: pointer; fill: var(--text-tertiary); stroke-width: 0; stroke-linejoin: round; stroke-linecap: round; height: 28px; width: 28px; stroke: var(--bg-base); transition: stroke-width 1s cubic-bezier(0, 2.5, 0.30, 2.5),
                        fill var(--duration-fast) var(--ease); margin-left: 4px; border-radius: var(--radius-xs); }
        .date-reset.clicked { stroke-width: 2; }
        .date-reset:hover { fill: var(--text-secondary); }
        .settings-controls { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0; }
    }
    .main { height: 100%; overflow: auto; display: grid; grid-auto-flow: row; grid-template-rows: auto auto auto 1fr; max-width: 100%; background-color: var(--bg-base); .filter-preview { background-color: var(--bg-overlay); padding: 6px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-subtle); svg { flex-shrink: 0; opacity: 0.4; }
            span { text-wrap: pretty; font-size: 12px; color: var(--text-secondary); letter-spacing: 0.01em; }
        }
        #logArea { height: 100%; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono',
                         Consolas, 'Liberation Mono', Menlo, monospace; font-size: 12px; line-height: 1.6; overflow: auto; padding: 12px 16px; user-select: text; cursor: auto; color: var(--text-secondary); div { padding: 1px 0; white-space: pre-wrap; }
            .error { color: var(--danger); }
            .success { color: var(--success); }
            .warn { color: var(--warning-text); }
        }
        .button-container { background-color: var(--bg-raised); display: flex; gap: 4px; padding: 5px 10px; border-bottom: 1px solid var(--border-subtle); #stopProcess { display: none; background-color: var(--danger); border-color: transparent; color: #fff; }
            #stopProcess:hover { background-color: var(--danger-hover); }
        }
    }
    .footer { width: 100%; padding: 6px 14px; height: 34px; background-color: var(--bg-raised); border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; .auto-scroll-container { label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; span { font-size: 10.5px; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
            }
        }
        .info-container,
        .info-container a { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; color: var(--text-tertiary); font-size: 10.5px; text-decoration: none; transition: color var(--duration-fast) var(--ease); }
        .info-container a:hover { color: var(--accent-hover); }
    }
    .scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .scroll::-webkit-scrollbar-corner { background-color: transparent; }
    .scroll::-webkit-scrollbar-thumb { background-clip: padding-box; border-radius: 3px; background-color: var(--bg-surface-active); min-height: 30px; }
    .scroll::-webkit-scrollbar-thumb:hover { background-color: var(--text-tertiary); }
    .scroll::-webkit-scrollbar-track { background-color: transparent; }
    .scroll::-webkit-scrollbar-thumb,
    .scroll::-webkit-scrollbar-track { visibility: hidden; }
    .scroll:hover::-webkit-scrollbar-thumb,
    .scroll:hover::-webkit-scrollbar-track { visibility: visible; }
}
`);

  const mainTemplate = (`
<div class="overlay"></div>
<div id="gptk" class="container">
  <div class="header">
    <div class="header-info">
      <div class="header-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4 7.17 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.17L15 4H9zm3 4.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
      </div>
      <div class="header-text">GoPro Cloud Toolkit</div>
    </div>
    <div class="header-steps">
      <span class="step-badge">1</span> Load
      <span class="step-arrow">&rarr;</span>
      <span class="step-badge">2</span> Filter
      <span class="step-arrow">&rarr;</span>
      <span class="step-badge">3</span> Action
    </div>
    <div id="hide" title="Hide (Esc)">
      <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18"><path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/></svg>
    </div>
  </div>

  <div class="window-body">
    <div class="sidebar scroll">

      <div class="panel-section">
        <div class="section-label"><span class="step-badge">1</span> Load Library</div>
        <div class="load-card">
          <button type="button" id="loadLibrary" class="btn-primary">Load library</button>
          <div id="libStatus" class="lib-status">Not loaded yet</div>
          <span class="filter-note">Reads metadata only. Nothing is downloaded or changed.</span>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-label">
          <span class="step-badge">2</span> Filters
          <div class="flex centered" title="Reset all filters" id="filterResetButton">
            <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14"><path d="M440-122q-121-15-200.5-105.5T160-440q0-66 26-126.5T260-672l57 57q-38 34-57.5 79T240-440q0 88 56 155.5T440-202v80Zm80 0v-80q87-16 143.5-83T720-440q0-100-70-170t-170-70h-3l44 44-56 56-140-140 140-140 56 56-44 44h3q134 0 227 93t93 227q0 121-79.5 211.5T520-122Z"/></svg>
            Reset
          </div>
        </div>
      </div>

      <form class="filters-form">
        <details class="type" open><summary>Type</summary><fieldset>
          <span class="filter-note">None ticked means all types.</span>
          <div class="radio-group" id="typeChecks"></div>
        </fieldset></details>

        <details class="camera"><summary>Camera</summary><fieldset>
          <select size="5" multiple="multiple" class="select-multiple scroll" name="cameras"><option value="" disabled>Load the library first</option></select>
          <div class="select-control-buttons-row">
            <button type="button" name="cameraAll">All</button>
            <button type="button" name="cameraNone">None</button>
          </div>
        </fieldset></details>

        <details class="date-interval"><summary>Date Interval</summary><fieldset>
          <legend>From:</legend>
          <div class="flex centered input-wrapper">
            <input type="datetime-local" name="lowerBoundaryDate">
            <div class="date-reset flex centered" title="Reset Input" name="dateReset">&times;</div>
          </div>
          <legend>To:</legend>
          <div class="flex centered input-wrapper">
            <input type="datetime-local" name="higherBoundaryDate">
            <div class="date-reset flex centered" title="Reset Input" name="dateReset">&times;</div>
          </div>
          <hr>
          <div class="radio-group">
            <label class="form-control"><input name="intervalType" type="radio" value="include" checked="checked"><span>Include</span></label>
            <label class="form-control"><input name="intervalType" type="radio" value="exclude"><span>Exclude</span></label>
          </div>
          <hr>
          <div class="radio-group">
            <label class="form-control"><input name="dateType" type="radio" value="taken" checked="checked"><span>Date Captured</span></label>
            <label class="form-control"><input name="dateType" type="radio" value="uploaded"><span>Date Uploaded</span></label>
          </div>
        </fieldset></details>

        <details class="filename"><summary>Filename</summary><fieldset>
          <label class="form-control"><legend>Regex:</legend><input name="fileNameRegex" value="" type="input" placeholder="e.g. ^GX01|\\.JPG$"></label>
          <div class="radio-group">
            <label class="form-control"><input name="fileNameMatchType" value="include" type="radio" checked="checked"> Include</label>
            <label class="form-control"><input name="fileNameMatchType" value="exclude" type="radio"> Exclude</label>
          </div>
        </fieldset></details>

        <details class="size"><summary>Size</summary><fieldset>
          <legend>More Than (MB)</legend><div class="input-wrapper"><input name="minSizeMb" type="number" min="0" step="any" placeholder="MB"></div>
          <legend>Less Than (MB)</legend><div class="input-wrapper"><input name="maxSizeMb" type="number" min="0" step="any" placeholder="MB"></div>
        </fieldset></details>

        <details class="resolution"><summary>Resolution</summary><fieldset>
          <legend>Min Width</legend><div class="input-wrapper"><input name="minWidth" type="number" min="0" placeholder="Pixels"></div>
          <legend>Min Height</legend><div class="input-wrapper"><input name="minHeight" type="number" min="0" placeholder="Pixels"></div>
        </fieldset></details>

        <details class="duration"><summary>Duration</summary><fieldset>
          <legend>Min Duration</legend><div class="input-wrapper"><input name="minDuration" type="number" min="0" step="any" placeholder="Seconds"></div>
          <legend>Max Duration</legend><div class="input-wrapper"><input name="maxDuration" type="number" min="0" step="any" placeholder="Seconds"></div>
        </fieldset></details>

        <details class="hilights"><summary>HiLight Tags</summary><fieldset>
          <div class="radio-group">
            <label class="form-control"><input name="hilights" value="" type="radio" checked="checked"> Any</label>
            <label class="form-control"><input name="hilights" value="with" type="radio"> Has HiLights</label>
            <label class="form-control"><input name="hilights" value="without" type="radio"> No HiLights</label>
          </div>
          <legend>At least</legend><div class="input-wrapper"><input name="minMoments" type="number" min="0" step="1" placeholder="Tag count"></div>
        </fieldset></details>

        <hr>
        <fieldset class="duplicates"><label class="form-control checkbox-control" title="Same filename, size and capture time. The oldest upload of each set is kept out of the results."><input name="duplicatesOnly" value="true" type="checkbox"><span>Duplicates only (keeps oldest copy)</span></label></fieldset>
        <fieldset class="hide-edits"><label class="form-control checkbox-control"><input name="hideEdits" value="true" type="checkbox"><span>Hide edits (MultiClipEdit)</span></label></fieldset>
        <fieldset class="sort-by-size"><label class="form-control checkbox-control"><input name="sortBySize" value="true" type="checkbox"><span>Sort by size</span></label></fieldset>
      </form>

      <form class="settings-form">
        <details class="settings"><summary>Advanced Settings</summary><fieldset>
          <legend>Parallel Downloads</legend><div class="input-wrapper"><input name="downloadConcurrency" value="2" min="1" max="5" type="number" required></div>
          <legend>Delay Between Downloads (ms)</legend><div class="input-wrapper"><input name="downloadDelayMs" value="1000" min="0" max="10000" type="number" required></div>
          <legend>Delete Batch Size</legend><div class="input-wrapper"><input name="deleteBatchSize" value="1" min="1" max="25" type="number" required></div>
          <label class="form-control checkbox-control"><input name="skipDownloaded" value="true" type="checkbox" checked="checked"><span>Skip files already downloaded</span></label>
          <div class="settings-controls">
            <button name="save" type="submit" class="btn-primary">Save</button>
            <button name="default" type="button">Default</button>
            <button name="resetHistory" type="button" title="Forget which files were downloaded">Reset history</button>
          </div>
          <legend>Diagnostics</legend>
          <span class="filter-note">Records what GoPro's own page sends to its API (no passwords or tokens), so a broken feature can be fixed exactly.</span>
          <div class="settings-controls">
            <button type="button" id="recordRequests">Record GoPro requests</button>
            <button type="button" id="exportRecording">Export recording</button>
            <button type="button" id="exportAlbumData" title="Save what GoPro returned when loading albums">Export album data</button>
          </div>
        </fieldset></details>
      </form>
    </div>

    <div class="main">
      <div class="action-bar">
        <div class="section-label"><span class="step-badge">3</span> Choose Action
          <label class="dry-run-toggle" title="List what would happen without doing it"><input type="checkbox" id="dryRun"><span>Dry run</span></label>
        </div>
        <div class="action-buttons">
          <button type="button" id="stats" title="Totals by type, camera and year">Stats</button>
          <button type="button" id="exportCsv" title="Download the metadata as a CSV file">Export CSV</button>
          <button type="button" id="exportJson" title="Download the raw metadata as a JSON file">Export JSON</button>
          <button type="button" id="exportLinks" title="Save temporary download links (aria2 input file)">Export Links</button>
          <button type="button" id="download" title="Download the original files">Download</button>
          <button type="button" id="listHilights" title="Log the HiLight tag times of every matching clip">List HiLights</button>
          <button type="button" id="openHilightEditor" title="Preview clips and view / edit their HiLight tags">HiLight Editor</button>
          <button type="button" id="addToAlbum" title="Add the matching items to the album chosen below">Add to Album</button>
          <button type="button" id="deleteCloud" title="Permanently delete from your GoPro cloud">Delete</button>
        </div>
        <div class="album-row">
          <span>Album:</span>
          <select id="albumSelect" class="dropdown"><option value="">Press Refresh albums</option></select>
          <button type="button" id="refreshAlbums" title="Load your GoPro albums">Refresh albums</button>
        </div>
      </div>

      <div class="filter-preview" title="Filter Preview">
        <span class="fp-text">Filter: None</span>
        <button type="button" class="fp-toggle">Show more</button>
      </div>
      <div class="button-container">
        <button id="stopProcess" type="button">Stop</button>
        <button id="clearLog" type="button">Clear Log</button>
      </div>
      <div id="logArea" class="logarea scroll"></div>
    </div>
  </div>

  <div id="hlEditor" class="hl-editor" hidden>
    <div class="hl-card">
      <div class="hl-head">
        <span class="hl-title">HiLight Editor</span>
        <button type="button" id="hlClose" title="Close (Esc)">Close</button>
      </div>
      <div class="hl-row">
        <select id="hlClip" class="dropdown" title="Clips matching the current filter"></select>
        <span id="hlCount" class="hl-muted"></span>
      </div>
      <video id="hlVideo" controls preload="metadata" playsinline></video>
      <div class="hl-row hl-tags-row"><span class="hl-muted">Tags:</span> <div id="hlTags" class="hl-tags"></div></div>
      <div class="hl-row">
        <button type="button" id="hlAdd" class="btn-primary" title="Add a HiLight at the player's current position">Add HiLight here</button>
        <button type="button" id="hlTest" title="Add one test tag to this clip, check it, then remove it">Test editing on this clip</button>
      </div>
      <div id="hlStatus" class="hl-status"></div>
    </div>
  </div>

  <div class="footer">
    <div class="info-container"><span>v%version% &middot; unofficial</span></div>
    <div class="auto-scroll-container">
      <label for="autoScroll"><input type="checkbox" id="autoScroll" checked="checked"><span>Auto-scroll</span></label>
    </div>
  </div>
</div>
`);

  const extraCss = `
#gptk .hl-editor { position: absolute; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
#gptk .hl-editor[hidden] { display: none; }
#gptk .hl-card { background: var(--bg-raised); border: 1px solid var(--border-default); border-radius: var(--radius-lg); width: min(860px, 100%); max-height: 100%; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
#gptk .hl-head { display: flex; align-items: center; justify-content: space-between; }
#gptk .hl-title { font-size: 14px; font-weight: 600; }
#gptk .hl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
#gptk .hl-row select { flex: 1 1 260px; min-width: 0; height: 30px; padding: 0 6px; }
#gptk .hl-muted { font-size: 12px; color: var(--text-tertiary); }
#gptk #hlVideo { width: 100%; max-height: 46vh; background: #000; border-radius: var(--radius-sm); }
#gptk .hl-tags { display: flex; flex-wrap: wrap; gap: 4px; }
#gptk .hl-tag { display: inline-flex; align-items: center; border: 1px solid var(--border-default); border-radius: 999px; overflow: hidden; }
#gptk .hl-tag button { height: 24px; border: 0; border-radius: 0; padding: 0 8px; text-transform: none; font-variant-numeric: tabular-nums; }
#gptk .hl-tag button.hl-del { padding: 0 7px; color: var(--danger-hover); border-left: 1px solid var(--border-default); }
#gptk .hl-status { font-size: 12px; color: var(--text-secondary); line-height: 1.45; white-space: pre-wrap; }
#gptk .hl-status.ok { color: var(--success); }
#gptk .hl-status.bad { color: var(--warning-text); }

#gptk .album-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 0 12px 8px; font-size: 12px; color: var(--text-secondary); }
#gptk #albumSelect { min-width: 180px; max-width: 360px; height: 28px; padding: 0 6px; }
#gptk #recordRequests.recording { background-color: var(--danger); color: #fff; border-color: transparent; }

/* layout: keep "Choose Action" pinned on top; long filter text collapses */
#gptk .main { display: flex; flex-direction: column; grid-template-rows: none; overflow-x: hidden; overflow-y: auto; }
#gptk .main > * { flex: 0 0 auto; min-width: 0; }
#gptk .main > .action-bar { position: sticky; top: 0; z-index: 10; box-shadow: 0 8px 14px -8px rgba(0, 0, 0, 0.6); }
#gptk .main > #logArea { flex: 1 1 0; min-height: 140px; height: auto; }
#gptk .main .filter-preview { align-items: flex-start; }
#gptk .main .filter-preview .fp-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
#gptk .main .filter-preview.expanded .fp-text { display: block; -webkit-line-clamp: unset; line-clamp: unset; max-height: 32vh; overflow-y: auto; }
#gptk .main .filter-preview .fp-toggle { display: none; flex-shrink: 0; height: 22px; padding: 0 8px; font-size: 10.5px; }
#gptk .main .filter-preview.overflowing .fp-toggle { display: inline-flex; }

#gptk .load-card { display: flex; flex-direction: column; gap: 6px; padding: 4px 4px 10px; }
#gptk .load-card button { width: 100%; justify-content: center; height: 32px; }
#gptk .lib-status { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
#gptk .lib-status.ok { color: var(--success); }
#gptk .date-reset { font-size: 18px; color: var(--text-tertiary); justify-content: center; line-height: 1; }
#gptk .date-reset:hover { color: var(--text-primary); }
#gptk .action-buttons button#deleteCloud { color: var(--danger-hover); border-color: rgba(239, 68, 68, 0.35); }
#gptk .action-buttons button#deleteCloud:not(:disabled):hover { background-color: var(--danger-muted); }
#gptk .dry-run-toggle input { margin: 0; }
#gptk .action-bar .dry-run-toggle { width: auto; margin-bottom: 0; }
#gptk-launcher { position: fixed; right: 20px; bottom: 20px; z-index: 498; width: 46px; height: 46px; border-radius: 50%; background: #0c0c0e; color: #3b82f6; border: 1px solid rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 24px rgba(0,0,0,0.45); transition: transform 0.12s ease; padding: 0; }
#gptk-launcher:hover { transform: scale(1.06); }
#gptk-launcher:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
`;

  // ════════════════════════════════════════════════════════════
  //  Small utilities
  // ════════════════════════════════════════════════════════════
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const errorMessage = (e) => (e instanceof Error ? e.message : String(e));
  const asArray = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

  function formatBytes(n) {
      if (!Number.isFinite(n) || n < 0) return '?';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
      return `${i === 0 ? n.toFixed(0) : n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
  }
  function formatDurationMs(ms) {
      if (!Number.isFinite(ms)) return '';
      const s = Math.round(ms / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return h ? `${h}h${String(m).padStart(2, '0')}m${String(sec).padStart(2, '0')}s` : m ? `${m}m${String(sec).padStart(2, '0')}s` : `${sec}s`;
  }
  function timeToHHMMSS(time) {
      const total = Math.floor(time / 1000);
      return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((n) => String(n).padStart(2, '0')).join(':');
  }
  const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function debounce(fn, wait) {
      let timer = null;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }
  function splitIntoChunks(arr, size) {
      size = Math.max(1, Math.floor(size) || 1);
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
  }
  function safeFileName(name) {
      const cleaned = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '_').trim().slice(0, 200);
      return cleaned || 'file';
  }
  function isPatternValid(pattern) {
      try { new RegExp(pattern); return true; } catch (e) { return e; }
  }
  function stamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }

  const LOG_MAX_LINES = 3000;
  function log(message, type = null) {
      const line = `[${clock()}] ${message}`;
      if (type === 'error') console.error(`[GoPro Toolkit] ${line}`); else console.log(`[GoPro Toolkit] ${line}`);
      try {
          const box = document.querySelector('#logArea');
          if (!box) return;
          const div = document.createElement('div');
          div.textContent = line;
          if (type) div.classList.add(type);
          box.appendChild(div);
          while (box.childElementCount > LOG_MAX_LINES) box.firstElementChild?.remove();
          if (document.querySelector('#autoScroll')?.checked) box.scrollTop = box.scrollHeight;
      } catch (e) { console.error(e); }
  }

  // ─── persistent settings / download history (page localStorage) ───
  const STORE_KEY = 'gopro-cloud-toolkit';
  function readStore() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') ?? {}; } catch { return {}; }
  }
  function getStored(key, fallback = null) {
      const v = readStore()[key];
      return v === undefined ? fallback : v;
  }
  function setStored(key, value) {
      try {
          const s = readStore(); s[key] = value;
          localStorage.setItem(STORE_KEY, JSON.stringify(s));
      } catch (e) { log(`Could not save ${key}: ${errorMessage(e)}`, 'error'); }
  }
  const settingsDefault = { downloadConcurrency: 2, downloadDelayMs: 1000, deleteBatchSize: 1, skipDownloaded: true };
  function sanitizeInt(value, fallback, min, max) {
      const n = Math.floor(Number(value));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
  function normalizeSettings(raw) {
      const s = raw ?? {};
      return {
          downloadConcurrency: sanitizeInt(s.downloadConcurrency, settingsDefault.downloadConcurrency, 1, 5),
          downloadDelayMs: sanitizeInt(s.downloadDelayMs, settingsDefault.downloadDelayMs, 0, 10000),
          deleteBatchSize: sanitizeInt(s.deleteBatchSize, settingsDefault.deleteBatchSize, 1, 25),
          skipDownloaded: s.skipDownloaded === undefined ? true : s.skipDownloaded === true || s.skipDownloaded === 'true',
      };
  }

  // ════════════════════════════════════════════════════════════
  //  API
  // ════════════════════════════════════════════════════════════
  class ApiError extends Error {
      constructor(message, status, retryable) {
          super(message);
          this.status = status;
          this.retryable = retryable;
      }
  }
  function getAccessToken() {
      let cookie = '';
      try { cookie = document.cookie; } catch { return null; } // some sandboxed pages forbid reading cookies
      const m = cookie.match(/(?:^|;\s*)gp_access_token=([^;]+)/);
      if (!m) return null;
      try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  function gmRequest(url, { method, headers, body = null }) {
      return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
              method, url, headers, data: body ?? undefined, withCredentials: true,
              onload: (r) => resolve({ status: r.status, ok: r.status >= 200 && r.status < 300, text: r.responseText ?? '' }),
              onerror: () => reject(new Error('Network error')),
              ontimeout: () => reject(new Error('Request timed out')),
          });
      });
  }
  /** fetch first (same as the site itself); if the browser blocks it (CORS/network), retry through the userscript manager. */
  async function transport(url, { method = 'GET', accept = ACCEPT_SEARCH, body = null, contentType = null } = {}) {
      const headers = { accept };
      if (contentType) headers['content-type'] = contentType;
      const token = getAccessToken();
      if (token) headers.authorization = `Bearer ${token}`;
      try {
          const response = await fetch(url, { method, headers, credentials: 'include', ...(body !== null ? { body } : {}) });
          return { status: response.status, ok: response.ok, text: await response.text() };
      }
      catch (error) {
          if (typeof GM_xmlhttpRequest === 'function') return gmRequest(url, { method, headers, body });
          throw error;
      }
  }

  class Api {
      async request(url, { method = 'GET', accept = ACCEPT_SEARCH, body = null, contentType = null, raw = false } = {}) {
          let last = null;
          for (let attempt = 1; attempt <= Api.MAX_RETRIES; attempt++) {
              try {
                  const res = await transport(url, { method, accept, body, contentType });
                  if (res.status === 401 || res.status === 403) {
                      throw new ApiError(`GoPro rejected the request (HTTP ${res.status}). Your session may have expired: reload the page or sign in again.`, res.status, false);
                  }
                  if (!res.ok) {
                      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408;
                      throw new ApiError(`HTTP ${res.status}${res.text ? `: ${String(res.text).slice(0, 300)}` : ''}`, res.status, !permanent);
                  }
                  if (raw) return res.text;
                  return res.text ? JSON.parse(res.text) : null;
              }
              catch (error) {
                  last = error instanceof Error ? error : new Error(String(error));
                  console.error(`[GoPro Toolkit] ${method} ${url.split('?')[0]} failed (attempt ${attempt}/${Api.MAX_RETRIES}): ${last.message}`);
                  if ((last instanceof ApiError && !last.retryable) || attempt === Api.MAX_RETRIES) break;
                  await sleep(Api.RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * Api.RETRY_BASE_MS * 0.3);
              }
          }
          throw last;
      }
      async searchPage(page) {
          const url = `${API}/media/search?processing_states=rendering,pretranscoding,transcoding,ready&fields=${SEARCH_FIELDS}&type=${MEDIA_TYPES.join(',')}&page=${page}&per_page=${PAGE_SIZE}`;
          const data = await this.request(url, { accept: ACCEPT_SEARCH });
          return {
              media: data?._embedded?.media ?? [],
              totalPages: Number(data?._pages?.total_pages) || 1,
          };
      }
      async getDownloadInfo(id) {
          return this.request(`${API}/media/${encodeURIComponent(id)}/download`, { accept: ACCEPT_SEARCH });
      }
      /** Sends a JSON body, returns the raw reply text. Only ever talks to api.gopro.com. */
      async send(url, { method = 'POST', body = null, contentType = 'application/json', accept = ACCEPT_MEDIA } = {}) {
          if (!isGoProApiUrl(url)) throw new Error('Refusing to send a request outside api.gopro.com');
          return this.request(url, { method, body, contentType, accept, raw: true });
      }
      /*
       * Albums, as recorded from GoPro's own media-library page:
       *   list   GET  /media/items?label=mural&type=collection&exclude_root=true&page=N&per_page=30  -> {items:[...], _pages}
       *   check  POST /media/items/{album}/media/check  {"medium_ids":[...]}              -> {found:[...], not_found:[...]}
       *   wrap   POST /media/items  {"type":"medium","medium_id":"...","label":"mural"}  -> 201 {type:"medium", id:<item id>}
       *   save   PUT  /media/items/{album}  {"shared":false,"item_ids":[...all...],"hero_id":"...","updated_at":"<album's current updated_at>"}
       * "mural" is GoPro's internal label for every album object; the album's name is its `title`.
       */
      async listAlbums() {
          const found = new Map();
          let page = 1, totalPages = 1;
          this.lastAlbumPages = [];
          while (page <= totalPages && page <= 50) {
              const data = await this.request(`${API}/media/items?label=mural&type=collection&exclude_root=true&page=${page}&per_page=30`, { accept: ACCEPT_MEDIA });
              this.lastAlbumPages.push(data);
              totalPages = Number(data?._pages?.total_pages) || 1;
              for (const raw of data?.items ?? []) {
                  const a = normalizeAlbum(raw);
                  if (a) found.set(a.id, a);
              }
              page++;
          }
          return [...found.values()];
      }
      async getAlbum(albumId) {
          return (await this.listAlbums()).find((a) => a.id === albumId) ?? null;
      }
      /** Which of these clips are already in the album. */
      async checkAlbum(albumId, mediaIds) {
          const reply = await this.send(`${API}/media/items/${encodeURIComponent(albumId)}/media/check`, { body: JSON.stringify({ medium_ids: mediaIds }) });
          const data = reply ? JSON.parse(reply) : {};
          return { found: data.found ?? [], notFound: data.not_found ?? [] };
      }
      /** Creates the hidden item that represents one clip inside an album. Returns its item id. */
      async createClipItem(mediaId, label) {
          const reply = await this.send(`${API}/media/items`, { body: JSON.stringify({ type: 'medium', medium_id: mediaId, label }) });
          const data = reply ? JSON.parse(reply) : null;
          if (!data?.id || data.type !== 'medium') throw new Error(`unexpected reply: ${clip(reply, 120)}`);
          if (data.medium?.id && data.medium.id !== mediaId) throw new Error('GoPro returned a different clip');
          return data.id;
      }
      /** Saves the album's full item list. updated_at must be the album's current value (GoPro uses it to detect conflicts). */
      async saveAlbumItems(album, itemIds) {
          const body = JSON.stringify({ shared: album.shared ?? false, item_ids: itemIds, hero_id: album.heroId ?? itemIds[0] ?? null, updated_at: album.updatedAt });
          const reply = await this.send(`${API}/media/items/${encodeURIComponent(album.id)}`, { method: 'PUT', body });
          const updated = normalizeAlbum(reply ? JSON.parse(reply) : null);
          if (!updated) throw new Error(`unexpected reply: ${clip(reply, 120)}`);
          return updated;
      }
      /*
       * HiLight tags ("moments").
       *   read   GET /media/{id}/moments?fields=id,time      (used by existing open-source GoPro clients)
       *   add    POST /media/{id}/moments {"time": t}         UNVERIFIED: only used after the one-clip test passed
       *   remove DELETE /media/{id}/moments/{momentId}       UNVERIFIED: only used after the one-clip test passed
       */
      async getMoments(mediaId) {
          const data = await this.request(`${API}/media/${encodeURIComponent(mediaId)}/moments?fields=id,time`, { accept: ACCEPT_MEDIA });
          return parseMoments(data);
      }
      async addMoment(mediaId, time) {
          return this.send(`${API}/media/${encodeURIComponent(mediaId)}/moments`, { body: JSON.stringify({ time }) });
      }
      async deleteMoment(mediaId, momentId) {
          return this.request(`${API}/media/${encodeURIComponent(mediaId)}/moments/${encodeURIComponent(momentId)}`, { method: 'DELETE', accept: ACCEPT_MEDIA, raw: true });
      }
      /** A light, streamable copy for previewing (falls back to the original file). */
      async getPreviewUrl(mediaId) {
          const info = await this.getDownloadInfo(mediaId);
          const vars = info?._embedded?.variations ?? [];
          const pick = vars.find((v) => v?.label === 'high_res_proxy_mp4') ?? vars.find((v) => v?.label === 'source');
          return pick?.url ?? null;
      }
      /** Returns the list of per-item errors GoPro reported (empty = all deleted). */
      async deleteMedia(ids) {
          const data = await this.request(`${API}/media?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE', accept: ACCEPT_MEDIA });
          return parseDeleteErrors(data);
      }
  }
  Api.MAX_RETRIES = 3;
  Api.RETRY_BASE_MS = 1500;

  function parseDeleteErrors(data) {
      if (!data) return [];
      const list = Array.isArray(data) ? data : Array.isArray(data?._embedded?.errors) ? data._embedded.errors : Array.isArray(data?.errors) ? data.errors : [];
      return list.filter((e) => e && typeof e === 'object');
  }
  function parseMoments(data) {
      const list = Array.isArray(data) ? data : data?._embedded?.moments ?? data?.moments ?? data?._embedded?.items ?? [];
      return list
          .map((m) => ({ id: m?.id !== undefined && m?.id !== null ? String(m.id) : null, time: toNumber(m?.time) }))
          .filter((m) => m.time !== null)
          .sort((a, b) => a.time - b.time);
  }
  /** Tag times are expected in milliseconds; if every tag fits inside the clip only when read as seconds, use seconds. */
  function inferMomentUnit(moments, durationMs) {
      if (!moments.length || !durationMs) return 'ms';
      const max = Math.max(...moments.map((m) => m.time));
      return max * 1000 <= durationMs && max < durationMs / 100 ? 's' : 'ms';
  }
  const toSeconds = (time, unit) => (unit === 's' ? time : time / 1000);
  const fromSeconds = (sec, unit) => (unit === 's' ? Math.round(sec) : Math.round(sec * 1000));
  function formatClock(sec) {
      if (!Number.isFinite(sec)) return '?';
      const m = Math.floor(sec / 60), s = sec - m * 60;
      return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }
  function extractSourceUrl(downloadInfo) {
      const source = downloadInfo?._embedded?.variations?.find((v) => v?.label === 'source');
      return source?.url ?? null;
  }

  // ════════════════════════════════════════════════════════════
  //  Items, filtering, stats
  // ════════════════════════════════════════════════════════════
  function toNumber(v) {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
  }
  function toTime(v) {
      if (!v) return null;
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
  }
  function normalizeItem(raw) {
      return {
          id: String(raw?.id ?? ''),
          filename: raw?.filename ?? null,
          title: raw?.content_title ?? null,
          type: raw?.type ?? null,
          extension: raw?.file_extension ?? null,
          cameraModel: raw?.camera_model ?? null,
          capturedAt: toTime(raw?.captured_at),
          capturedAtRaw: raw?.captured_at ?? null,
          timezone: raw?.captured_at_timezone ?? null,
          createdAt: toTime(raw?.created_at),
          createdAtRaw: raw?.created_at ?? null,
          size: toNumber(raw?.file_size),
          width: toNumber(raw?.width),
          height: toNumber(raw?.height),
          durationMs: toNumber(raw?.source_duration), // assumed to be milliseconds (the API sends it as a string)
          moments: toNumber(raw?.moments_count) ?? 0,
          readyToView: raw?.ready_to_view ?? null,
          token: raw?.token ?? null,
          itemCount: toNumber(raw?.item_count),
          raw,
      };
  }
  /** Same filename + size + capture time. The oldest upload of each set is NOT reported as a duplicate. */
  function computeDuplicateIds(items) {
      const groups = new Map();
      for (const item of items) {
          if (!item.filename || !item.size) continue;
          const key = `${item.filename}|${item.size}|${item.capturedAt ?? ''}`;
          const g = groups.get(key);
          if (g) g.push(item); else groups.set(key, [item]);
      }
      const dup = new Set();
      for (const g of groups.values()) {
          if (g.length < 2) continue;
          g.sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity) || a.id.localeCompare(b.id));
          for (let i = 1; i < g.length; i++) dup.add(g[i].id);
      }
      return dup;
  }
  function dateBounds(f) {
      const lo = new Date(f.lowerBoundaryDate ?? '').getTime();
      const hi = new Date(f.higherBoundaryDate ?? '').getTime();
      return [Number.isNaN(lo) ? -Infinity : lo, Number.isNaN(hi) ? Infinity : hi];
  }
  const num = (v) => { const n = parseFloat(v ?? ''); return Number.isNaN(n) ? null : n; };

  function validateFilter(f) {
      if (f.fileNameRegex) {
          const r = isPatternValid(f.fileNameRegex);
          if (r !== true) return `Error: Invalid filename regex (${errorMessage(r)})`;
      }
      if (f.lowerBoundaryDate && f.higherBoundaryDate && f.lowerBoundaryDate >= f.higherBoundaryDate) return 'Error: Invalid Date Interval';
      const [minS, maxS] = [num(f.minSizeMb), num(f.maxSizeMb)];
      if ((minS !== null && minS < 0) || (maxS !== null && maxS < 0)) return 'Error: Size cannot be negative';
      if (minS !== null && maxS !== null && minS >= maxS) return 'Error: Invalid Size Filter';
      const [minD, maxD] = [num(f.minDuration), num(f.maxDuration)];
      if ((minD !== null && minD < 0) || (maxD !== null && maxD < 0)) return 'Error: Duration cannot be negative';
      if (minD !== null && maxD !== null && minD >= maxD) return 'Error: Invalid Duration Filter';
      if (f.hilights === 'without' && (num(f.minMoments) ?? 0) > 0) return 'Error: "No HiLights" cannot be combined with a minimum tag count';
      for (const key of ['minWidth', 'minHeight', 'minMoments']) {
          const v = num(f[key]);
          if (v !== null && v < 0) return `Error: ${key} cannot be negative`;
      }
      return null;
  }
  function describeFilter(f) {
      const error = validateFilter(f);
      if (error) return error;
      const parts = [];
      const types = asArray(f.types);
      if (types.length) parts.push(types.join('/'));
      const cams = asArray(f.cameras);
      if (cams.length) parts.push(cams.length === 1 ? `camera ${cams[0]}` : `${cams.length} camera models`);
      if (f.duplicatesOnly === 'true') parts.push('duplicates (oldest copy kept)');
      if (f.hideEdits === 'true') parts.push('without edits');
      if (f.fileNameRegex) parts.push(`filename ${f.fileNameMatchType === 'exclude' ? 'not matching' : 'matching'} /${f.fileNameRegex}/`);
      if (f.lowerBoundaryDate || f.higherBoundaryDate) {
          const fmt = (v) => new Date(v).toLocaleString('en-GB');
          const lo = f.lowerBoundaryDate ? fmt(f.lowerBoundaryDate) : null;
          const hi = f.higherBoundaryDate ? fmt(f.higherBoundaryDate) : null;
          const ex = f.intervalType === 'exclude';
          const what = f.dateType === 'uploaded' ? 'uploaded' : 'captured';
          if (lo && hi) parts.push(ex ? `${what} before ${lo} or after ${hi}` : `${what} ${lo} to ${hi}`);
          else if (lo) parts.push(ex ? `${what} before ${lo}` : `${what} after ${lo}`);
          else parts.push(ex ? `${what} after ${hi}` : `${what} before ${hi}`);
      }
      if (num(f.minSizeMb) !== null) parts.push(`> ${num(f.minSizeMb)} MB`);
      if (num(f.maxSizeMb) !== null) parts.push(`< ${num(f.maxSizeMb)} MB`);
      if (num(f.minWidth) !== null) parts.push(`width >= ${num(f.minWidth)}px`);
      if (num(f.minHeight) !== null) parts.push(`height >= ${num(f.minHeight)}px`);
      if (num(f.minDuration) !== null) parts.push(`duration >= ${num(f.minDuration)}s`);
      if (num(f.maxDuration) !== null) parts.push(`duration <= ${num(f.maxDuration)}s`);
      if (num(f.minMoments) !== null) parts.push(`${num(f.minMoments)}+ HiLight tags`);
      if (f.hilights === 'with') parts.push('with HiLights');
      if (f.hilights === 'without') parts.push('without HiLights');
      if (f.sortBySize === 'true') parts.push('largest first');
      return parts.length ? `Filter: ${parts.join(', ')}` : 'Filter: None (entire library)';
  }

  /** Pure: library items in, matching items out. `dupIds` must be computed over the WHOLE library. */
  function applyFilters(items, f, dupIds = new Set()) {
      let out = items;
      if (f.duplicatesOnly === 'true') out = out.filter((i) => dupIds.has(i.id));
      if (f.hideEdits === 'true') out = out.filter((i) => i.type !== 'MultiClipEdit');
      const types = asArray(f.types);
      if (types.length) out = out.filter((i) => types.includes(i.type));
      const cams = asArray(f.cameras);
      if (cams.length) out = out.filter((i) => i.cameraModel && cams.includes(i.cameraModel));
      if (f.lowerBoundaryDate || f.higherBoundaryDate) {
          const [lo, hi] = dateBounds(f);
          const key = f.dateType === 'uploaded' ? 'createdAt' : 'capturedAt';
          const exclude = f.intervalType === 'exclude';
          out = out.filter((i) => {
              const t = i[key];
              const inRange = t !== null && t >= lo && t <= hi;
              return exclude ? !inRange : inRange;
          });
      }
      if (f.fileNameRegex) {
          const re = new RegExp(f.fileNameRegex);
          const exclude = f.fileNameMatchType === 'exclude';
          out = out.filter((i) => re.test(i.filename ?? '') !== exclude);
      }
      const minB = num(f.minSizeMb) !== null ? num(f.minSizeMb) * 1048576 : null;
      const maxB = num(f.maxSizeMb) !== null ? num(f.maxSizeMb) * 1048576 : null;
      if (minB !== null) out = out.filter((i) => i.size !== null && i.size > minB);
      if (maxB !== null) out = out.filter((i) => i.size !== null && i.size < maxB);
      const minW = num(f.minWidth), minH = num(f.minHeight);
      if (minW !== null) out = out.filter((i) => i.width !== null && i.width >= minW);
      if (minH !== null) out = out.filter((i) => i.height !== null && i.height >= minH);
      const minD = num(f.minDuration), maxD = num(f.maxDuration);
      if (minD !== null) out = out.filter((i) => i.durationMs !== null && i.durationMs >= minD * 1000);
      if (maxD !== null) out = out.filter((i) => i.durationMs !== null && i.durationMs <= maxD * 1000);
      if (f.hilights === 'with') out = out.filter((i) => i.moments > 0);
      else if (f.hilights === 'without') out = out.filter((i) => i.moments === 0);
      const minM = num(f.minMoments);
      if (minM !== null) out = out.filter((i) => i.moments >= minM);
      out = out === items ? items.slice() : out;
      if (f.sortBySize === 'true') out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
      return out;
  }
  const sumSize = (items) => items.reduce((n, i) => n + (i.size ?? 0), 0);

  function groupStats(items, keyFn) {
      const map = new Map();
      for (const item of items) {
          const k = keyFn(item) ?? 'Unknown';
          const e = map.get(k) ?? { key: k, count: 0, size: 0 };
          e.count++; e.size += item.size ?? 0;
          map.set(k, e);
      }
      return [...map.values()].sort((a, b) => b.size - a.size || b.count - a.count);
  }

  // ─── CSV ───
  function toCsvValue(value) {
      if (value === undefined || value === null) return '';
      let text;
      if (typeof value === 'object') text = JSON.stringify(value) ?? '';
      else if (typeof value === 'string') {
          text = value;
          // neutralise spreadsheet formulas in user-controlled text such as titles and filenames
          if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      }
      else text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  const CSV_HEADERS = ['id', 'filename', 'title', 'type', 'cameraModel', 'capturedAt', 'capturedAtTimezone', 'uploadedAt', 'sizeBytes', 'width', 'height', 'durationMs', 'hilightTags', 'readyToView', 'itemCount', 'token'];
  function itemsToCsv(items) {
      const rows = items.map((i) => [i.id, i.filename, i.title, i.type, i.cameraModel, i.capturedAtRaw, i.timezone, i.createdAtRaw, i.size, i.width, i.height, i.durationMs, i.moments, i.readyToView, i.itemCount, i.token]);
      return [CSV_HEADERS, ...rows].map((r) => r.map(toCsvValue).join(',')).join('\r\n');
  }
  function saveTextFile(fileName, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  /** Unique, filesystem-safe names; clashes get the media id appended. */
  function assignFileNames(items) {
      const used = new Set();
      const names = new Map();
      for (const item of items) {
          let name = safeFileName(item.filename ?? `${item.id}${item.extension ? '.' + item.extension : ''}`);
          if (used.has(name.toLowerCase())) {
              const dot = name.lastIndexOf('.');
              name = dot > 0 ? `${name.slice(0, dot)}_${item.id}${name.slice(dot)}` : `${name}_${item.id}`;
          }
          used.add(name.toLowerCase());
          names.set(item.id, name);
      }
      return names;
  }

  // ─── bounded-concurrency worker pool; one failure never aborts the rest ───
  async function runPool(list, concurrency, worker, isRunning) {
      let cursor = 0;
      const runners = Array.from({ length: Math.min(Math.max(1, concurrency), list.length) }, async () => {
          while (cursor < list.length && isRunning()) {
              const index = cursor++;
              await worker(list[index], index);
          }
      });
      await Promise.all(runners);
  }

  function gmDownloadOnce(url, name, core) {
      return new Promise((resolve, reject) => {
          if (typeof GM_download !== 'function') {
              // last resort: let the browser handle the link; completion cannot be observed
              const a = document.createElement('a');
              a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(resolve, 800);
              return;
          }
          let handle = null;
          // Stop must always settle this promise: some managers never fire a callback after abort()
          const entry = { abort() { try { handle?.abort?.(); } catch { /* ignore */ } reject(new Error('stopped')); } };
          const finish = (fn, arg) => { core.aborters.delete(entry); fn(arg); };
          core.aborters.add(entry);
          handle = GM_download({
              url, name, saveAs: false,
              onload: () => finish(resolve),
              onerror: (e) => finish(reject, Object.assign(new Error(e?.error ? `${e.error}${e.details ? ': ' + e.details : ''}` : 'download failed'), { code: e?.error })),
              ontimeout: () => finish(reject, new Error('download timed out')),
          });
      });
  }
  async function gmDownload(url, name, core) {
      try {
          return await gmDownloadOnce(url, `GoPro/${name}`, core);
      }
      catch (error) {
          // Tampermonkey only allows sub-folders when "Browser API" downloads are enabled
          if (core.running && (error.code === 'not_whitelisted' || error.code === 'not_permitted' || /file ?name/i.test(error.message))) {
              return gmDownloadOnce(url, name, core);
          }
          throw error;
      }
  }

  // ════════════════════════════════════════════════════════════
  //  Albums + request recorder
  // ════════════════════════════════════════════════════════════
  const isGoProApiUrl = (url) => /^https:\/\/api\.gopro\.com\//i.test(String(url));
  function normalizeAlbum(raw) {
      if (!raw || typeof raw !== 'object' || raw.type !== 'collection' || raw.root === true || !raw.id) return null;
      return {
          id: String(raw.id),
          label: raw.title ?? raw.name ?? 'Untitled album',
          internalLabel: raw.label ?? 'mural',
          itemIds: Array.isArray(raw.item_ids) ? raw.item_ids.map(String) : [],
          count: Array.isArray(raw.item_ids) ? raw.item_ids.length : null,
          heroId: raw.hero_id ?? null,
          shared: typeof raw.shared === 'boolean' ? raw.shared : false,
          updatedAt: raw.updated_at ?? null,
          createdAt: raw.created_at ?? null,
      };
  }
  function redactUrl(url) {
      try {
          const u = new URL(String(url));
          for (const k of [...u.searchParams.keys()]) {
              if (/token|signature|key|auth|credential|^x-amz-/i.test(k)) u.searchParams.set(k, 'REDACTED');
          }
          return `${u.origin}${u.pathname}${u.search}`;
      } catch { return String(url); }
  }
  const clip = (text, n) => (text === null || text === undefined ? null : String(text).length > n ? `${String(text).slice(0, n)}…[${String(text).length - n} more chars]` : String(text));

  /** Watches the GoPro page's own API calls (fetch + XHR). Requests always pass through unchanged. */
  const recorder = { on: false, entries: [], max: 400, restore: null, onAlbums: null };
  function pageWindow() { return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; }
  function exportFn(fn, target) { return typeof exportFunction === 'function' ? exportFunction(fn, target) : fn; }
  function recordEntry(method, url, reqBody, status, resText) {
      if (!recorder.on || !isGoProApiUrl(url)) return;
      const entry = { time: new Date().toISOString(), method: String(method).toUpperCase(), url: redactUrl(url), requestBody: clip(typeof reqBody === 'string' ? reqBody : reqBody ? '[non-text body]' : null, 2000), status, response: clip(resText, 4000) };
      recorder.entries.push(entry);
      if (recorder.entries.length > recorder.max) recorder.entries.shift();
      log(`REC ${entry.method} ${new URL(entry.url).pathname} → ${status}`);
      if (entry.method === 'GET' && /\/media\/items\?/.test(entry.url) && /type=collection/.test(entry.url) && resText) {
          try {
              const albums = (JSON.parse(resText)?.items ?? []).map(normalizeAlbum).filter(Boolean);
              if (albums.length) recorder.onAlbums?.(albums);
          } catch { /* not JSON */ }
      }
  }
  function startRecorder() {
      if (recorder.on) return;
      const W = pageWindow();
      const origFetch = W.fetch;
      const proto = W.XMLHttpRequest?.prototype;
      const origOpen = proto?.open, origSend = proto?.send;
      const meta = new WeakMap();
      if (typeof origFetch === 'function') {
          W.fetch = exportFn(function (input, init) {
              const p = origFetch.apply(this, arguments);
              try {
                  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
                  if (isGoProApiUrl(url)) {
                      const method = init?.method ?? input?.method ?? 'GET';
                      const body = init?.body;
                      p.then((res) => (typeof res.clone === 'function' ? res.clone() : res).text().then((t) => recordEntry(method, url, body, res.status, t))).catch(() => {});
                  }
              } catch { /* never break the page */ }
              return p;
          }, W);
      }
      if (proto && origOpen && origSend) {
          proto.open = exportFn(function (method, url) {
              try { meta.set(this, { method: String(method), url: new URL(String(url), W.location.href).href }); } catch { /* ignore */ }
              return origOpen.apply(this, arguments);
          }, W);
          proto.send = exportFn(function (body) {
              try {
                  const m = meta.get(this);
                  if (m && isGoProApiUrl(m.url)) {
                      const xhr = this;
                      this.addEventListener('loadend', () => {
                          let text = null;
                          try { text = xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : `[${xhr.responseType} response]`; } catch { /* ignore */ }
                          recordEntry(m.method, m.url, body, xhr.status, text);
                      });
                  }
              } catch { /* ignore */ }
              return origSend.apply(this, arguments);
          }, W);
      }
      recorder.restore = () => {
          if (typeof origFetch === 'function') W.fetch = origFetch;
          if (proto && origOpen && origSend) { proto.open = origOpen; proto.send = origSend; }
      };
      recorder.on = true;
  }
  function stopRecorder() {
      if (recorder.restore) { try { recorder.restore(); } catch { /* ignore */ } }
      recorder.restore = null;
      recorder.on = false;
  }

  // ════════════════════════════════════════════════════════════
  //  Core
  // ════════════════════════════════════════════════════════════
  const ACTIONS = {
      stats: { label: 'Stats', readOnly: true, alwaysRuns: true },
      exportCsv: { label: 'Export CSV', readOnly: true },
      exportJson: { label: 'Export JSON', readOnly: true },
      exportLinks: { label: 'Export Links', readOnly: true },
      download: { label: 'Download', confirm: true },
      listHilights: { label: 'List HiLights', readOnly: true, alwaysRuns: true },
      addToAlbum: { label: 'Add to Album', confirm: true, needsAlbum: true },
      deleteCloud: { label: 'Delete from cloud', confirm: true, destructive: true },
  };

  class Core {
      constructor() {
          this.running = false;
          this.api = new Api();
          this.library = null;      // array of normalized items
          this.loadedAt = null;
          this.dupIds = new Set();
          this.settings = normalizeSettings(null);
          this.aborters = new Set();
          this.onStateChange = null;
          this.onLibraryChange = null;
          this.notify = () => { try { this.onStateChange?.(); } catch (e) { console.error(e); } };
      }
      stop() {
          this.running = false;
          for (const h of this.aborters) { try { h?.abort?.(); } catch { /* ignore */ } }
          this.aborters.clear();
      }
      setLibrary(items) {
          this.library = items;
          this.loadedAt = items ? new Date() : null;
          this.dupIds = items ? computeDuplicateIds(items) : new Set();
          try { this.onLibraryChange?.(); } catch (e) { console.error(e); }
          this.notify();
      }
      /** All-or-nothing: a failed page aborts the load, so a partial library is never used for actions. */
      async fetchLibrary() {
          const byId = new Map();
          let page = 1, totalPages = 1;
          const started = Date.now();
          while (page <= totalPages && page <= MAX_PAGES) {
              if (!this.running) return null;
              const { media, totalPages: tp } = await this.api.searchPage(page);
              totalPages = tp;
              if (!media.length) break;
              for (const raw of media) {
                  const item = normalizeItem(raw);
                  if (item.id) byId.set(item.id, item);
              }
              log(`Loaded page ${page}/${totalPages} (${byId.size} items)`);
              page++;
          }
          if (!this.running) return null;
          const items = [...byId.values()];
          log(`Library loaded: ${items.length} items, ${formatBytes(sumSize(items))} in ${timeToHHMMSS(Date.now() - started)}`, 'success');
          return items;
      }
      async loadLibrary() {
          if (this.running) { log('Another task is already running', 'error'); return false; }
          this.running = true; this.notify();
          try {
              const items = await this.fetchLibrary();
              if (!items) { log('Stopped', 'warn'); return false; }
              this.setLibrary(items);
              return true;
          }
          catch (error) {
              log(`Could not load the library: ${errorMessage(error)}`, 'error');
              return false;
          }
          finally { this.running = false; this.notify(); }
      }
      matching(filter) {
          return applyFilters(this.library ?? [], filter, this.dupIds);
      }

      async run(actionId, filter, settings, options = {}) {
          const { dryRun = false, confirm = null, album = null } = options;
          const action = ACTIONS[actionId];
          if (!action) { log(`Unknown action: ${actionId}`, 'error'); return; }
          if (this.running) { log('Another task is already running', 'error'); return; }
          const error = validateFilter(filter);
          if (error) { log(error, 'error'); return; }
          if (action.needsAlbum && !album?.id) {
              log('Choose an album first (press "Refresh albums" if the list is empty)', 'error');
              return;
          }
          this.targetAlbum = album;
          this.settings = normalizeSettings(settings);
          this.running = true; this.notify();
          const started = Date.now();
          try {
              if (!this.library) {
                  log('Library not loaded yet, loading it first');
                  const items = await this.fetchLibrary();
                  if (!items) { log('Stopped', 'warn'); return; }
                  this.setLibrary(items);
              }
              const items = this.matching(filter);
              log(`${describeFilter(filter)} → ${items.length} of ${this.library.length} items (${formatBytes(sumSize(items))})`);
              if (!items.length) { log('No items to process'); return; }
              if (dryRun && !action.alwaysRuns) {
                  await this.preview(actionId, items);
                  log(`Dry run finished in ${timeToHHMMSS(Date.now() - started)}. Nothing was changed.`, 'success');
                  return;
              }
              if (action.confirm && confirm && !(await confirm(items))) {
                  log('Cancelled. Nothing was changed.', 'warn');
                  return;
              }
              await this[actionId](items);
              if (this.running) log(`${action.label} finished in ${timeToHHMMSS(Date.now() - started)}`, 'success');
              else log('Stopped before completion; some items may already have been processed', 'warn');
          }
          catch (error) {
              log(error instanceof Error ? (error.stack ?? error.message) : String(error), 'error');
          }
          finally {
              this.running = false;
              this.aborters.clear();
              this.notify();
          }
      }

      async preview(actionId, items) {
          log(`DRY RUN (${ACTIONS[actionId].label}): ${items.length} item(s), ${formatBytes(sumSize(items))}`, 'warn');
          let list = items;
          if (actionId === 'download' && this.settings.skipDownloaded) {
              const ledger = getStored('downloaded', {});
              const todo = items.filter((i) => !(ledger[i.id] && i.size && Math.abs(ledger[i.id] - i.size) < 1024));
              log(`${items.length - todo.length} already downloaded earlier and would be skipped; ${todo.length} would download (${formatBytes(sumSize(todo))})`);
              list = todo;
          }
          if (actionId === 'addToAlbum') log(`Would add these to album "${this.targetAlbum.label}" (clips already in it are skipped)`);
          const shown = list.slice(0, 40);
          for (const i of shown) {
              const when = i.capturedAt ? new Date(i.capturedAt).toLocaleString('en-GB') : 'no date';
              log(`  ${i.filename ?? i.id}  ·  ${i.type ?? '?'}  ·  ${when}  ·  ${formatBytes(i.size ?? NaN)}`);
          }
          if (list.length > shown.length) log(`  …and ${list.length - shown.length} more`);
      }

      // ─── actions ───
      async stats(items) {
          log(`── Stats for ${items.length} items (${formatBytes(sumSize(items))}) ──`);
          const fmt = (g) => `${g.key}: ${g.count} (${formatBytes(g.size)})`;
          log(`By type:   ${groupStats(items, (i) => i.type).map(fmt).join(' | ')}`);
          log(`By camera: ${groupStats(items, (i) => i.cameraModel).slice(0, 12).map(fmt).join(' | ')}`);
          const years = groupStats(items, (i) => (i.capturedAt ? new Date(i.capturedAt).getFullYear() : 'No date')).sort((a, b) => String(a.key).localeCompare(String(b.key)));
          log(`By year:   ${years.map(fmt).join(' | ')}`);
          const durationTotal = items.reduce((n, i) => n + (i.durationMs ?? 0), 0);
          if (durationTotal) log(`Total video duration: ${formatDurationMs(durationTotal)}`);
          log('Largest 10:');
          for (const i of [...items].sort((a, b) => (b.size ?? 0) - (a.size ?? 0)).slice(0, 10)) {
              log(`  ${i.filename ?? i.id}  ·  ${formatBytes(i.size ?? NaN)}  ·  ${i.type ?? '?'}`);
          }
          const dupInSet = items.filter((i) => this.dupIds.has(i.id));
          const dupAll = (this.library ?? []).filter((i) => this.dupIds.has(i.id));
          log(`Duplicates (extra copies): ${dupInSet.length} in this selection, ${dupAll.length} in the whole library, wasting ${formatBytes(sumSize(dupAll))}`);
      }
      async exportCsv(items) {
          saveTextFile(`gopro-metadata-${stamp()}.csv`, `﻿${itemsToCsv(items)}\r\n`, 'text/csv;charset=utf-8');
          log(`Saved CSV with ${items.length} rows`);
      }
      async exportJson(items) {
          saveTextFile(`gopro-metadata-${stamp()}.json`, JSON.stringify(items.map((i) => i.raw), null, 2), 'application/json');
          log(`Saved JSON with ${items.length} items`);
      }
      /** Resolves each item's temporary source URL. Returns [{item, url}] and logs what had none. */
      async resolveSourceUrls(items) {
          const resolved = [];
          let noSource = 0, failed = 0, done = 0;
          await runPool(items, 3, async (item) => {
              try {
                  const url = extractSourceUrl(await this.api.getDownloadInfo(item.id));
                  if (url) resolved.push({ item, url }); else noSource++;
              }
              catch (error) {
                  failed++;
                  log(`Could not get a link for ${item.filename ?? item.id}: ${errorMessage(error)}`, 'error');
              }
              if (++done % 50 === 0) log(`Resolved ${done}/${items.length} links`);
          }, () => this.running);
          if (noSource) log(`${noSource} item(s) have no downloadable source file (edits and some sets). They were skipped.`, 'warn');
          if (failed) log(`${failed} link request(s) failed`, 'error');
          const order = new Map(items.map((i, n) => [i.id, n]));
          return resolved.sort((a, b) => order.get(a.item.id) - order.get(b.item.id));
      }
      async exportLinks(items) {
          log(`Getting download links for ${items.length} items`);
          const resolved = await this.resolveSourceUrls(items);
          if (!resolved.length) { log('No links to save'); return; }
          const names = assignFileNames(resolved.map((r) => r.item));
          const text = resolved.map((r) => `${r.url}\n  out=${names.get(r.item.id)}`).join('\n') + '\n';
          saveTextFile(`gopro-links-${stamp()}.txt`, text, 'text/plain;charset=utf-8');
          log(`Saved ${resolved.length} links. Run:  aria2c -i <file> -x4 -j2   (links expire, so use them soon)`);
      }
      async download(items) {
          const ledger = getStored('downloaded', {});
          let todo = items;
          if (this.settings.skipDownloaded) {
              todo = items.filter((i) => !(ledger[i.id] && i.size && Math.abs(ledger[i.id] - i.size) < 1024));
              if (todo.length !== items.length) log(`Skipping ${items.length - todo.length} files downloaded earlier`);
          }
          if (!todo.length) { log('Nothing new to download'); return; }
          const names = assignFileNames(todo);
          let ok = 0, failed = 0, noSource = 0, n = 0;
          log(`Downloading ${todo.length} files (${formatBytes(sumSize(todo))}). Allow multiple downloads if your browser asks.`);
          await runPool(todo, this.settings.downloadConcurrency, async (item) => {
              const label = `[${++n}/${todo.length}] ${names.get(item.id)} (${formatBytes(item.size ?? NaN)})`;
              try {
                  const url = extractSourceUrl(await this.api.getDownloadInfo(item.id));
                  if (!url) { noSource++; log(`${label}: no downloadable source, skipped`, 'warn'); return; }
                  if (!this.running) return;
                  log(`${label}: downloading`);
                  await gmDownload(url, names.get(item.id), this);
                  if (!this.running) return;
                  ok++;
                  ledger[item.id] = item.size ?? 0;
                  if (ok % 10 === 0) setStored('downloaded', ledger); // not every file: the ledger can be large
              }
              catch (error) {
                  if (!this.running) return; // aborted by Stop, not a real failure
                  failed++;
                  log(`${label}: failed (${errorMessage(error)})`, 'error');
              }
              if (this.settings.downloadDelayMs && this.running) await sleep(this.settings.downloadDelayMs);
          }, () => this.running);
          setStored('downloaded', ledger);
          log(`Downloads done: ${ok} ok, ${failed} failed, ${noSource} without source`, failed ? 'warn' : 'success');
      }
      async refreshAlbums() {
          if (this.running) { log('Another task is already running', 'error'); return null; }
          this.running = true; this.notify();
          try {
              log('Loading albums');
              const albums = await this.api.listAlbums();
              albums.sort((a, b) => a.label.localeCompare(b.label));
              log(albums.length ? `Albums loaded: ${albums.map((a) => `"${a.label}" (${a.count ?? '?'})`).join(', ')}` : 'You have no albums yet. Create one on the GoPro page first.', albums.length ? 'success' : 'warn');
              return albums;
          }
          catch (error) {
              log(`Could not load albums: ${errorMessage(error)}`, 'error');
              return null;
          }
          finally { this.running = false; this.notify(); }
      }
      /**
       * Same three steps GoPro's page uses: check -> create one item per new clip -> save the album's item list.
       * Clips go 25 at a time and every batch is saved before the next starts, so stopping midway leaves the
       * album consistent. GoPro's reply is checked after every save to confirm the new items are really in it.
       */
      async addToAlbum(items) {
          let album = await this.api.getAlbum(this.targetAlbum.id);
          if (!album) { log(`Album "${this.targetAlbum.label}" was not found any more. Press "Refresh albums".`, 'error'); return; }
          log(`Adding to "${album.label}" (currently ${album.itemIds.length} item(s))`);

          const already = new Set();
          for (const chunk of splitIntoChunks(items.map((i) => i.id), 50)) {
              if (!this.running) return;
              const { found } = await this.api.checkAlbum(album.id, chunk);
              for (const id of found) already.add(String(id));
          }
          const todo = items.filter((i) => !already.has(i.id));
          if (already.size) log(`${already.size} clip(s) are already in the album and will be skipped`);
          if (!todo.length) { log('Nothing new to add'); return; }

          let added = 0, failed = 0;
          for (const batch of splitIntoChunks(todo, 25)) {
              if (!this.running) break;
              const made = [];
              await runPool(batch, 3, async (item) => {
                  try { made.push({ order: batch.indexOf(item), id: await this.api.createClipItem(item.id, album.internalLabel) }); }
                  catch (error) { failed++; log(`Could not prepare ${item.filename ?? item.id}: ${errorMessage(error)}`, 'error'); }
              }, () => true); // finish the batch even if Stop is pressed, so nothing is left half-done
              if (!made.length) continue;
              const ids = made.sort((a, b) => a.order - b.order).map((x) => x.id);
              let saved;
              try { saved = await this.api.saveAlbumItems(album, [...album.itemIds, ...ids]); }
              catch (error) {
                  log(`Saving the album failed (${errorMessage(error)}); reloading it and retrying once`, 'warn');
                  album = await this.api.getAlbum(album.id);
                  if (!album) { log('The album disappeared', 'error'); return; }
                  saved = await this.api.saveAlbumItems(album, [...album.itemIds, ...ids]);
              }
              const missing = ids.filter((id) => !saved.itemIds.includes(id));
              if (missing.length) {
                  log(`STOPPED: GoPro saved the album but ${missing.length} new item(s) are not in it. Nothing else was sent.`, 'error');
                  return;
              }
              album = saved;
              added += ids.length;
              log(`Added ${added}/${todo.length} (album now has ${album.itemIds.length} item(s))`);
          }
          this.targetAlbum = album;
          log(`Add to Album: ${added} added, ${already.size} already there, ${failed} failed`, failed ? 'warn' : 'success');
          if (added) log('Reload the album on the GoPro page to see them.');
      }
      async listHilights(items) {
          const list = items.slice(0, 300);
          if (items.length > list.length) log(`Showing the first ${list.length} of ${items.length} clips`);
          let withTags = 0, done = 0;
          const rows = new Array(list.length);
          await runPool(list, 4, async (item, idx) => {
              try {
                  const moments = await this.api.getMoments(item.id);
                  const unit = inferMomentUnit(moments, item.durationMs);
                  if (moments.length) withTags++;
                  item.moments = moments.length;
                  rows[idx] = `  ${item.filename ?? item.id}: ${moments.length ? moments.map((m) => formatClock(toSeconds(m.time, unit))).join(', ') : 'no HiLights'}`;
              }
              catch (error) { rows[idx] = `  ${item.filename ?? item.id}: could not read (${errorMessage(error)})`; }
              if (++done % 50 === 0) log(`Read ${done}/${list.length}`);
          }, () => this.running);
          for (const r of rows) if (r) log(r);
          log(`${withTags} of ${list.length} clip(s) have HiLights`);
      }

      /**
       * The one-clip experiment: read → add one test tag → read → remove it → read.
       * Every step is checked; the first surprise stops everything. Saves what worked.
       */
      async testHilightEditing(item, atSeconds) {
          if (this.running) { log('Another task is already running', 'error'); return null; }
          this.running = true; this.notify();
          const result = { add: false, remove: false, unit: 'ms', clip: item.filename ?? item.id, testedAt: new Date().toISOString(), detail: '' };
          const done = (detail, cls = 'warn') => { result.detail = detail; log(detail, cls); setStored('hilightApi', result); return result; };
          try {
              const before = await this.api.getMoments(item.id);
              result.unit = inferMomentUnit(before, item.durationMs);
              log(`Test on ${result.clip}: ${before.length} existing tag(s); time unit assumed: ${result.unit === 's' ? 'seconds' : 'milliseconds'}`);
              let sec = Number.isFinite(atSeconds) && atSeconds > 0 ? atSeconds : (item.durationMs ? item.durationMs / 2000 : 1);
              let t = fromSeconds(sec, result.unit);
              while (before.some((m) => m.time === t)) t += result.unit === 's' ? 1 : 500;

              let reply;
              try { reply = await this.api.addMoment(item.id, t); }
              catch (error) { return done(`Adding a tag is not possible this way. GoPro answered: ${errorMessage(error)}. Nothing was changed.`); }
              log(`GoPro replied to the add: ${clip(reply, 200) || '(empty)'}`);

              let after = await this.api.getMoments(item.id);
              let added = after.filter((m) => !before.some((b) => (m.id && b.id ? b.id === m.id : b.time === m.time)));
              if (!added.length) { await sleep(2000); after = await this.api.getMoments(item.id); added = after.filter((m) => !before.some((b) => (m.id && b.id ? b.id === m.id : b.time === m.time))); }
              if (!added.length) return done('GoPro accepted the request but no new tag appeared, so adding does not work this way. Nothing else was sent.');
              if (added.length > 1) return done(`STOPPED: ${added.length} tags appeared instead of one. Check this clip in the Quik app.`, 'error');
              const tag = added[0];
              if (Math.abs(tag.time - t) > (result.unit === 's' ? 1 : 1000)) return done(`STOPPED: the new tag is at ${tag.time}, not ${t} as sent. Check this clip in the Quik app.`, 'error');
              result.add = true;
              log(`Add works: tag appeared at ${formatClock(toSeconds(tag.time, result.unit))}`, 'success');

              if (!tag.id) return done('Add works, but GoPro gives tags no id, so removing cannot be tested. The test tag is still on the clip; remove it in the Quik app.', 'warn');
              try { await this.api.deleteMoment(item.id, tag.id); }
              catch (error) { return done(`Add works, but removing does not (${errorMessage(error)}). The test tag is still on ${result.clip} at ${formatClock(toSeconds(tag.time, result.unit))}; remove it in the Quik app.`); }
              const final = await this.api.getMoments(item.id);
              if (final.some((m) => m.id === tag.id)) return done(`Add works, but the test tag did not go away after removing. It is still on ${result.clip}; remove it in the Quik app.`);
              if (final.length !== before.length) return done(`STOPPED: the clip now has ${final.length} tag(s) instead of ${before.length}. Check it in the Quik app.`, 'error');
              result.remove = true;
              return done('HiLight editing works: a test tag was added and removed again. "Add HiLight here" and the ✕ buttons are now enabled.', 'success');
          }
          catch (error) {
              return done(`Test interrupted: ${errorMessage(error)}`, 'error');
          }
          finally { this.running = false; this.notify(); }
      }
      async addHilight(item, sec) {
          const api = getStored('hilightApi');
          if (!api?.add) throw new Error('Run "Test editing on this clip" first');
          const before = await this.api.getMoments(item.id);
          const t = fromSeconds(sec, api.unit);
          if (before.some((m) => m.time === t)) return before;
          await this.api.addMoment(item.id, t);
          const after = await this.api.getMoments(item.id);
          if (after.length !== before.length + 1) throw new Error(`expected ${before.length + 1} tag(s), GoPro now reports ${after.length}`);
          item.moments = after.length;
          return after;
      }
      async removeHilight(item, momentId) {
          const api = getStored('hilightApi');
          if (!api?.remove) throw new Error('Removing has not been verified on your account yet');
          const before = await this.api.getMoments(item.id);
          await this.api.deleteMoment(item.id, momentId);
          const after = await this.api.getMoments(item.id);
          if (after.some((m) => m.id === momentId) || after.length !== before.length - 1) throw new Error(`GoPro now reports ${after.length} tag(s)`);
          item.moments = after.length;
          return after;
      }
      async deleteCloud(items) {
          // always leave a record of what was removed
          saveTextFile(`gopro-deleted-backup-${stamp()}.csv`, `﻿${itemsToCsv(items)}\r\n`, 'text/csv;charset=utf-8');
          log(`Saved a CSV backup list of the ${items.length} items about to be deleted`);
          const chunks = splitIntoChunks(items.map((i) => i.id), this.settings.deleteBatchSize);
          const deleted = new Set();
          const failedIds = new Map();
          let processed = 0;
          await runPool(chunks, 2, async (ids) => {
              try {
                  const errors = await this.api.deleteMedia(ids);
                  const bad = new Map(errors.filter((e) => e.id).map((e) => [String(e.id), e.description ?? e.reason ?? e.code ?? 'error']));
                  if (errors.length && !bad.size) {
                      for (const id of ids) failedIds.set(id, errors[0].description ?? errors[0].reason ?? 'error');
                  }
                  else {
                      for (const id of ids) { if (bad.has(id)) failedIds.set(id, bad.get(id)); else deleted.add(id); }
                  }
              }
              catch (error) {
                  for (const id of ids) failedIds.set(id, errorMessage(error));
                  log(`Delete request failed for ${ids.length} item(s): ${errorMessage(error)}`, 'error');
              }
              processed += ids.length;
              if (processed % 50 === 0 || processed === items.length) log(`Processed ${processed}/${items.length}`);
          }, () => this.running);
          if (deleted.size && this.library) {
              this.setLibrary(this.library.filter((i) => !deleted.has(i.id)));
          }
          log(`Deleted ${deleted.size} item(s). Failed: ${failedIds.size}.`, failedIds.size ? 'warn' : 'success');
          for (const [id, why] of [...failedIds].slice(0, 20)) log(`  not deleted ${id}: ${why}`, 'error');
          if (deleted.size) log('Press "Load library" again to double-check the result against GoPro.');
      }
  }

  const core = new Core();

  // ════════════════════════════════════════════════════════════
  //  UI
  // ════════════════════════════════════════════════════════════
  function getFormData(selector) {
      const form = {};
      const el = document.querySelector(selector);
      if (!el) return form;
      for (const [key, value] of new FormData(el)) {
          const v = typeof value === 'string' ? value : value.name;
          if (!v) continue;
          if (Reflect.has(form, key)) {
              if (!Array.isArray(form[key])) form[key] = [form[key]];
              form[key].push(v);
          }
          else form[key] = v;
      }
      return form;
  }
  const readFilter = () => getFormData('.filters-form');

  function hasChangedFromDefault(container) {
      for (const input of container.querySelectorAll('input[type="text"], input[type="input"], input[type="number"], input[type="datetime-local"]')) {
          if (input.value.trim() !== input.defaultValue.trim()) return true;
      }
      for (const input of container.querySelectorAll('input[type="radio"], input[type="checkbox"]')) {
          if (input.checked !== input.defaultChecked) return true;
      }
      for (const select of container.querySelectorAll('select')) {
          for (const option of select.options) if (option.selected !== option.defaultSelected) return true;
      }
      return false;
  }
  function highlightActiveFilters() {
      const form = document.querySelector('.filters-form');
      if (!form) return;
      for (const d of form.querySelectorAll('details')) d.classList.toggle('filter-active', hasChangedFromDefault(d));
      for (const f of form.querySelectorAll(':scope > fieldset')) f.classList.toggle('filter-active', hasChangedFromDefault(f));
  }

  /** Collapses a long filter description to two lines and shows a Show more / Show less button when needed. */
  function refreshPreviewToggle() {
      const box = document.querySelector('.filter-preview');
      const text = box?.querySelector('.fp-text');
      const btn = box?.querySelector('.fp-toggle');
      if (!box || !text || !btn) return;
      text.title = text.textContent ?? '';
      const wasExpanded = box.classList.contains('expanded');
      box.classList.remove('expanded');
      const overflowing = text.scrollHeight > text.clientHeight + 1;
      const expanded = wasExpanded && overflowing;
      box.classList.toggle('expanded', expanded);
      box.classList.toggle('overflowing', overflowing);
      btn.textContent = expanded ? 'Show less' : 'Show more';
  }
  function previewToggleListeners() {
      document.querySelector('.fp-toggle')?.addEventListener('click', () => {
          const box = document.querySelector('.filter-preview');
          const btn = document.querySelector('.fp-toggle');
          if (!box || !btn) return;
          const expanded = box.classList.toggle('expanded');
          btn.textContent = expanded ? 'Show less' : 'Show more';
      });
      window.addEventListener('resize', debounce(refreshPreviewToggle, 100));
  }

  function updateUI() {
      const filter = readFilter();
      const preview = document.querySelector('.filter-preview span');
      if (preview) {
          let text = describeFilter(filter);
          if (core.library && !text.startsWith('Error')) {
              try {
                  const matched = core.matching(filter);
                  text += `  →  ${matched.length.toLocaleString()} of ${core.library.length.toLocaleString()} items (${formatBytes(sumSize(matched))})`;
              }
              catch { /* preview only */ }
          }
          preview.textContent = text;
          try { refreshPreviewToggle(); } catch { /* cosmetic */ }
      }
      const status = document.getElementById('libStatus');
      if (status) {
          if (core.library) {
              status.textContent = `${core.library.length.toLocaleString()} items · ${formatBytes(sumSize(core.library))} · loaded ${clock()}`;
              status.classList.add('ok');
          }
          else { status.textContent = 'Not loaded yet'; status.classList.remove('ok'); }
      }
      const loadBtn = document.getElementById('loadLibrary');
      if (loadBtn) loadBtn.textContent = core.library ? 'Refresh library' : 'Load library';
      for (const b of document.querySelectorAll('.action-bar button, .action-bar input, .action-bar select, #loadLibrary')) b.disabled = core.running;
      try { hlRefreshControls(); } catch { /* editor not built yet */ }
      const rec = document.getElementById('recordRequests');
      if (rec) { rec.textContent = recorder.on ? `Stop recording (${recorder.entries.length})` : 'Record GoPro requests'; rec.classList.toggle('recording', recorder.on); }
      const stop = document.getElementById('stopProcess');
      if (stop) stop.style.display = core.running ? 'block' : 'none';
      highlightActiveFilters();
  }

  function populateCameras() {
      const select = document.querySelector('select[name="cameras"]');
      if (!select) return;
      const previous = new Set([...select.selectedOptions].map((o) => o.value));
      while (select.options.length) select.remove(0);
      const models = [...new Set((core.library ?? []).map((i) => i.cameraModel).filter(Boolean))].sort();
      if (!models.length) {
          const o = document.createElement('option');
          o.value = ''; o.disabled = true; o.textContent = core.library ? 'No camera info' : 'Load the library first';
          select.appendChild(o);
          return;
      }
      for (const m of models) {
          const o = document.createElement('option');
          o.value = m; o.textContent = m; o.selected = previous.has(m);
          select.appendChild(o);
      }
  }

  function populateAlbums(albums) {
      const select = document.getElementById('albumSelect');
      if (!select) return;
      const keep = select.value;
      while (select.options.length) select.remove(0);
      const first = document.createElement('option');
      first.value = '';
      first.textContent = albums?.length ? 'Choose album…' : 'Press Refresh albums';
      select.appendChild(first);
      for (const a of albums ?? []) {
          const o = document.createElement('option');
          o.value = a.id;
          o.textContent = a.count !== null && a.count !== undefined ? `${a.label} (${a.count})` : a.label;
          o.title = a.id;
          select.appendChild(o);
      }
      if ([...select.options].some((o) => o.value === keep)) select.value = keep;
  }
  function mergeAlbums(found) {
      const byId = new Map((getStored('albums', []) ?? []).map((a) => [a.id, a]));
      let added = 0;
      for (const a of found) { if (!byId.has(a.id)) added++; byId.set(a.id, { ...byId.get(a.id), ...a }); }
      const list = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
      setStored('albums', list);
      populateAlbums(list);
      return added;
  }
  function selectedAlbum() {
      const id = document.getElementById('albumSelect')?.value;
      return id ? (getStored('albums', []) ?? []).find((a) => a.id === id) ?? null : null;
  }

  function userConfirmation(actionId, filter, items) {
      const action = ACTIONS[actionId];
      const lines = [describeFilter(filter), `Action: ${action.label}`, '', `Matched items: ${items.length.toLocaleString()} (${formatBytes(sumSize(items))})`];
      if (actionId === 'download') {
          lines.push('', 'Files are saved to your browser download folder (under GoPro/ if your userscript manager allows sub-folders).');
          return window.confirm(`${lines.join('\n')}\n\nProceed?`);
      }
      if (actionId === 'addToAlbum') {
          lines.push('', `Album: ${selectedAlbum()?.label ?? '?'}`, '', 'Clips already in the album are skipped. Nothing is removed from the album.');
          return window.confirm(`${lines.join('\n')}\n\nProceed?`);
      }
      if (actionId === 'deleteCloud') {
          const everything = core.library && items.length === core.library.length;
          const phrase = everything ? 'DELETE ALL' : 'DELETE';
          lines.push('', everything ? 'THIS IS YOUR ENTIRE LIBRARY.' : '', 'This PERMANENTLY deletes the items from your GoPro cloud. It cannot be undone.', 'A CSV list of the deleted items will be saved first.', '', `Type ${phrase} to continue:`);
          const answer = window.prompt(lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n'));
          return answer !== null && answer.trim() === phrase;
      }
      return true;
  }

  /** Unchecked checkboxes are absent from FormData, so read the checkbox explicitly. */
  function readSettings() {
      const raw = getFormData('.settings-form');
      raw.skipDownloaded = document.querySelector('.settings-form input[name="skipDownloaded"]')?.checked ?? true;
      return normalizeSettings(raw);
  }

  async function runAction(actionId) {
      if (core.running) return;
      const form = document.querySelector('.filters-form');
      if (form && !form.checkValidity()) { form.reportValidity(); return; }
      const filter = readFilter();
      const err = validateFilter(filter);
      if (err) { log(err, 'error'); return; }
      const settings = readSettings();
      const dryRun = document.getElementById('dryRun')?.checked ?? false;
      const btn = document.getElementById(actionId);
      btn?.classList.add('running');
      try {
          await core.run(actionId, filter, settings, { dryRun, album: selectedAlbum(), confirm: (items) => userConfirmation(actionId, filter, items) });
      }
      finally {
          btn?.classList.remove('running');
          updateUI();
      }
  }

  // Trusted Types: use our own named policy rather than claiming the page-wide 'default'
  let htmlPolicy = null;
  function toTrustedHTML(html) {
      const tt = window.trustedTypes;
      if (!tt?.createPolicy) return html;
      if (!htmlPolicy) {
          for (const name of ['gopro-toolkit-html', 'default']) {
              try { htmlPolicy = tt.createPolicy(name, { createHTML: (s) => s }); break; } catch { /* try next */ }
          }
          htmlPolicy ??= { createHTML: (s) => s };
      }
      return htmlPolicy.createHTML(html);
  }

  // ─── HiLight editor ───
  const hl = { item: null, moments: [], unit: 'ms', busy: false, loadSeq: 0 };
  function hlEls() {
      const q = (id) => document.getElementById(id);
      return { box: q('hlEditor'), clip: q('hlClip'), count: q('hlCount'), video: q('hlVideo'), tags: q('hlTags'), add: q('hlAdd'), test: q('hlTest'), status: q('hlStatus') };
  }
  function hlStatus(text, cls = '') {
      const { status } = hlEls();
      if (!status) return;
      status.textContent = text;
      status.className = `hl-status ${cls}`;
  }
  function hlApiStatusText() {
      const api = getStored('hilightApi');
      if (!api) return ['Editing not tested yet. Press "Test editing on this clip" on a clip you don\'t mind experimenting with (it adds one tag and removes it again).', ''];
      if (api.add && api.remove) return [`Editing works on your account (tested on ${api.clip}).`, 'ok'];
      return [`Last test (${api.clip}): ${api.detail}`, 'bad'];
  }
  function hlRefreshControls() {
      const { add, test, tags } = hlEls();
      const api = getStored('hilightApi');
      if (add) add.disabled = hl.busy || core.running || !hl.item || !api?.add;
      if (test) test.disabled = hl.busy || core.running || !hl.item;
      for (const b of tags?.querySelectorAll('button.hl-del') ?? []) b.disabled = hl.busy || core.running || !api?.remove;
  }
  function hlRenderTags() {
      const { tags, video, clip: sel, count } = hlEls();
      if (!tags) return;
      const opt = sel?.selectedOptions?.[0];
      if (opt && hl.item && opt.value === hl.item.id) {
          opt.textContent = opt.textContent.replace(/· \d+ tag\(s\)$/, `· ${hl.moments.length} tag(s)`);
          if (count && !/loading/.test(count.textContent)) count.textContent = `${hl.moments.length} HiLight(s) · ${formatDurationMs(hl.item.durationMs ?? NaN) || '?'}`;
      }
      tags.replaceChildren();
      if (!hl.moments.length) {
          const none = document.createElement('span');
          none.className = 'hl-muted'; none.textContent = 'none';
          tags.appendChild(none);
      }
      for (const m of hl.moments) {
          const sec = toSeconds(m.time, hl.unit);
          const wrap = document.createElement('span'); wrap.className = 'hl-tag';
          const seek = document.createElement('button'); seek.type = 'button'; seek.textContent = formatClock(sec); seek.title = 'Jump here';
          seek.addEventListener('click', () => { try { video.currentTime = sec; } catch { /* not loaded yet */ } });
          const del = document.createElement('button'); del.type = 'button'; del.className = 'hl-del'; del.textContent = '✕'; del.title = 'Remove this HiLight';
          del.addEventListener('click', () => void hlRemove(m));
          wrap.append(seek, del);
          tags.appendChild(wrap);
      }
      hlRefreshControls();
  }
  async function hlSelect(id) {
      const { video, count } = hlEls();
      hl.item = (core.library ?? []).find((i) => i.id === id) ?? null;
      hl.moments = [];
      hlRenderTags();
      if (!hl.item) return;
      const seq = ++hl.loadSeq;
      count.textContent = 'loading…';
      try {
          const [moments, url] = await Promise.all([core.api.getMoments(hl.item.id), core.api.getPreviewUrl(hl.item.id).catch(() => null)]);
          if (seq !== hl.loadSeq) return;
          hl.moments = moments;
          const api = getStored('hilightApi');
          hl.unit = api?.add ? api.unit : inferMomentUnit(moments, hl.item.durationMs);
          hl.item.moments = moments.length;
          count.textContent = `${moments.length} HiLight(s) · ${formatDurationMs(hl.item.durationMs ?? NaN) || '?'}`;
          if (url) video.src = url; else { video.removeAttribute('src'); hlStatus('No preview available for this clip.', 'bad'); }
          hlRenderTags();
      }
      catch (error) {
          if (seq === hl.loadSeq) { count.textContent = ''; hlStatus(`Could not load this clip: ${errorMessage(error)}`, 'bad'); }
      }
  }
  function openHilightEditor() {
      const { box, clip: sel } = hlEls();
      if (!core.library) { log('Load the library first', 'error'); return; }
      const err = validateFilter(readFilter());
      if (err) { log(err, 'error'); return; }
      const items = core.matching(readFilter()).slice(0, 500);
      sel.replaceChildren();
      for (const i of items) {
          const o = document.createElement('option');
          o.value = i.id;
          const when = i.capturedAt ? new Date(i.capturedAt).toLocaleDateString('en-CA') : 'no date';
          o.textContent = `${i.filename ?? i.id} · ${when} · ${i.moments} tag(s)`;
          sel.appendChild(o);
      }
      if (!items.length) { log('No clips match the current filter', 'warn'); return; }
      box.hidden = false;
      hlStatus(...hlApiStatusText());
      void hlSelect(items[0].id);
  }
  function closeHilightEditor() {
      const { box, video } = hlEls();
      if (!box || box.hidden) return false;
      try { video.pause?.(); } catch { /* ignore */ }
      box.hidden = true;
      updateUI();
      return true;
  }
  async function hlRun(fn) {
      if (hl.busy) return;
      hl.busy = true; hlRefreshControls();
      try { await fn(); }
      finally { hl.busy = false; hlRefreshControls(); updateUI(); }
  }
  async function hlAdd() {
      const { video } = hlEls();
      const sec = Number(video.currentTime) || 0;
      await hlRun(async () => {
          try {
              hl.moments = await core.addHilight(hl.item, sec);
              hlStatus(`Added a HiLight at ${formatClock(sec)}.`, 'ok');
              log(`Added HiLight to ${hl.item.filename} at ${formatClock(sec)}`, 'success');
          }
          catch (error) { hlStatus(`Could not add: ${errorMessage(error)}`, 'bad'); log(`Could not add HiLight: ${errorMessage(error)}`, 'error'); }
          hlRenderTags();
      });
  }
  async function hlRemove(m) {
      if (!window.confirm(`Remove the HiLight at ${formatClock(toSeconds(m.time, hl.unit))} from ${hl.item?.filename}?`)) return;
      await hlRun(async () => {
          try {
              hl.moments = await core.removeHilight(hl.item, m.id);
              hlStatus(`Removed the HiLight at ${formatClock(toSeconds(m.time, hl.unit))}.`, 'ok');
              log(`Removed HiLight from ${hl.item.filename}`, 'success');
          }
          catch (error) { hlStatus(`Could not remove: ${errorMessage(error)}`, 'bad'); log(`Could not remove HiLight: ${errorMessage(error)}`, 'error'); }
          hlRenderTags();
      });
  }
  async function hlTest() {
      const { video } = hlEls();
      if (!hl.item) return;
      const sec = Number(video.currentTime) || 0;
      const ok = window.confirm(`Test HiLight editing on "${hl.item.filename}"?\n\nThe toolkit will add ONE test tag${sec ? ` at ${formatClock(sec)}` : ' in the middle of the clip'}, check that it appeared, remove it again and check that it is gone. If anything unexpected happens it stops immediately and tells you.\n\nProceed?`);
      if (!ok) return;
      await hlRun(async () => {
          hlStatus('Testing…');
          const result = await core.testHilightEditing(hl.item, sec);
          hlStatus(...hlApiStatusText());
          if (result) { hl.moments = await core.api.getMoments(hl.item.id).catch(() => hl.moments); hl.unit = result.unit; }
          hlRenderTags();
      });
  }

  const isMenuOpen = () => document.getElementById('gptk')?.style.display === 'flex';
  function showMainMenu() {
      const gptk = document.getElementById('gptk');
      const overlay = document.querySelector('#gptk-root .overlay, .overlay');
      if (gptk) gptk.style.display = 'flex';
      if (overlay) overlay.style.display = 'block';
      updateUI();
  }
  function hideMainMenu() {
      const gptk = document.getElementById('gptk');
      const overlay = document.querySelector('#gptk-root .overlay, .overlay');
      if (gptk) gptk.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
  }

  function insertLauncher() {
      const ensure = () => {
          if (document.getElementById('gptk-launcher') || !document.body) return;
          const b = document.createElement('button');
          b.id = 'gptk-launcher'; b.type = 'button';
          b.title = 'GoPro Cloud Toolkit'; b.setAttribute('aria-label', 'GoPro Cloud Toolkit');
          b.innerHTML = toTrustedHTML('<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4 7.17 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.17L15 4H9zm3 4.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>');
          b.addEventListener('click', showMainMenu);
          document.body.appendChild(b);
      };
      ensure();
      let scheduled = false;
      new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => { scheduled = false; ensure(); });
      }).observe(document.body, { childList: true });
  }

  function buildTypeChecks() {
      const holder = document.getElementById('typeChecks');
      if (!holder) return;
      for (const t of MEDIA_TYPES) {
          const label = document.createElement('label');
          label.className = 'form-control';
          const input = document.createElement('input');
          input.type = 'checkbox'; input.name = 'types'; input.value = t;
          label.append(input, ` ${t}`);
          holder.appendChild(label);
      }
  }

  function insertUi() {
      const host = document.createElement('div');
      host.id = 'gptk-root';
      host.innerHTML = toTrustedHTML(mainTemplate.replace('%version%', VERSION));
      document.body.appendChild(host);
      const style = document.createElement('style');
      style.textContent = css + extraCss;
      document.head.appendChild(style);
      buildTypeChecks();
  }

  function setupListeners() {
      const root = document.getElementById('gptk');
      root.addEventListener('change', updateUI);
      root.addEventListener('input', debounce(updateUI, 150));
      core.onStateChange = updateUI;
      previewToggleListeners();
      core.onLibraryChange = populateCameras;
      document.getElementById('hide').addEventListener('click', hideMainMenu);
      document.querySelector('.overlay').addEventListener('click', hideMainMenu);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen() && !closeHilightEditor()) hideMainMenu(); });

      document.getElementById('loadLibrary').addEventListener('click', () => { void core.loadLibrary(); });
      document.getElementById('refreshAlbums').addEventListener('click', async () => {
          const albums = await core.refreshAlbums();
          if (albums) { setStored('albums', albums); populateAlbums(albums); }
          updateUI();
      });
      document.getElementById('openHilightEditor').addEventListener('click', () => openHilightEditor());
      document.getElementById('hlClose').addEventListener('click', () => closeHilightEditor());
      document.getElementById('hlClip').addEventListener('change', (e) => void hlSelect(e.target.value));
      document.getElementById('hlAdd').addEventListener('click', () => void hlAdd());
      document.getElementById('hlTest').addEventListener('click', () => void hlTest());
      document.getElementById('exportAlbumData').addEventListener('click', () => {
          const pages = core.api.lastAlbumPages;
          if (!pages?.length) { log('Press "Refresh albums" first'); return; }
          saveTextFile(`gopro-album-data-${stamp()}.json`, JSON.stringify({ toolkitVersion: VERSION, request: 'GET /media/items?label=mural&type=collection&exclude_root=true', pages }, null, 2), 'application/json');
          log(`Saved ${pages.length} page(s) of album data. It can contain clip names and ids, but no passwords or tokens.`);
      });
      recorder.onAlbums = (found) => {
          const added = mergeAlbums(found);
          if (added) log(`Picked up ${added} album(s) from the GoPro page`, 'success');
      };
      document.getElementById('recordRequests').addEventListener('click', () => {
          if (recorder.on) { stopRecorder(); log(`Recording stopped: ${recorder.entries.length} request(s). Press "Export recording" to save them.`); }
          else { recorder.entries = []; startRecorder(); log('Recording GoPro requests. Use the GoPro page normally (e.g. open your albums, add a clip to an album), then come back and stop.', 'warn'); }
          updateUI();
      });
      document.getElementById('exportRecording').addEventListener('click', () => {
          if (!recorder.entries.length) { log('Nothing recorded yet'); return; }
          saveTextFile(`gopro-requests-${stamp()}.json`, JSON.stringify({ toolkitVersion: VERSION, page: location.pathname, entries: recorder.entries }, null, 2), 'application/json');
          log(`Saved ${recorder.entries.length} recorded request(s). Tokens and signatures in URLs are replaced with REDACTED; the file can still contain clip names and ids.`);
      });
      for (const id of Object.keys(ACTIONS)) {
          document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); void runAction(id); });
      }
      document.getElementById('clearLog').addEventListener('click', () => document.getElementById('logArea')?.replaceChildren());
      document.getElementById('stopProcess').addEventListener('click', () => {
          log('Stopping (requests already in flight will finish first)', 'warn');
          core.stop();
          updateUI();
      });

      for (const btn of document.querySelectorAll('[name="dateReset"]')) {
          btn.addEventListener('click', () => {
              const input = btn.parentNode?.querySelector('input');
              if (input) input.value = '';
              updateUI();
          });
      }
      document.getElementById('filterResetButton').addEventListener('click', () => {
          document.querySelector('.filters-form')?.reset();
          updateUI();
      });
      const camSelect = () => document.querySelector('select[name="cameras"]');
      document.querySelector('[name="cameraAll"]')?.addEventListener('click', () => { for (const o of camSelect().options) if (o.value) o.selected = true; updateUI(); });
      document.querySelector('[name="cameraNone"]')?.addEventListener('click', () => { for (const o of camSelect().options) o.selected = false; updateUI(); });

      // settings
      const form = document.querySelector('.settings-form');
      const apply = (s) => {
          for (const key of ['downloadConcurrency', 'downloadDelayMs', 'deleteBatchSize']) form.querySelector(`input[name="${key}"]`).value = String(s[key]);
          form.querySelector('input[name="skipDownloaded"]').checked = s.skipDownloaded;
      };
      apply(normalizeSettings(getStored('settings')));
      form.addEventListener('submit', (e) => {
          e.preventDefault();
          setStored('settings', readSettings());
          log('Settings saved');
      });
      form.querySelector('button[name="default"]').addEventListener('click', () => { setStored('settings', settingsDefault); apply(settingsDefault); log('Default settings restored'); });
      form.querySelector('button[name="resetHistory"]').addEventListener('click', () => { setStored('downloaded', {}); log('Download history cleared'); });

      window.addEventListener('beforeunload', (e) => {
          if (core.running) { e.preventDefault(); e.returnValue = ''; }
      });
  }

  function init() {
      if (document.getElementById('gptk-root')) return;
      insertUi();
      setupListeners();
      insertLauncher();
      try { GM_registerMenuCommand('Open GoPro Cloud Toolkit', showMainMenu); } catch (e) { console.warn('[GoPro Toolkit] menu command unavailable', e); }
      populateCameras();
      if ((getStored('albums', []) ?? []).some((a) => !Array.isArray(a.itemIds))) setStored('albums', []); // lists saved by v1.2.x used the wrong fields
      populateAlbums(getStored('albums', []));
      updateUI();
      log(`GoPro Cloud Toolkit v${VERSION} ready. Press "Load library" to begin. Tick "Dry run" to preview any action.`);
  }

  try {
      /*TEST_HOOK*/
      init();
  }
  catch (error) {
      console.error('[GoPro Toolkit] Failed to initialise', error);
  }
})();