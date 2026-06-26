(function () {
  "use strict";

  /*
    Match:
      PUBMED:29601579,
      PUBMED: 29601579,

    Rules:
      - PUBMED is case-insensitive.
      - PMID is 1 to 10 digits.
      - The PMID must be followed by an English comma.
      - The comma is preserved outside the link.
  */
  const PUBMED_REGEX = /\bPUBMED\s*:\s*([1-9]\d{0,9})(?=,)/gi;

  const SKIP_TAGS = new Set([
    "A",
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "INPUT",
    "CODE",
    "PRE",
    "NOSCRIPT"
  ]);

  function injectStyle() {
    if (document.getElementById("pubmed-linkifier-style")) return;

    const style = document.createElement("style");
    style.id = "pubmed-linkifier-style";
    style.textContent = `
      a.pubmed-link {
        font-weight: 650;
        text-decoration: none;
        border-bottom: 1px dotted currentColor;
      }

      a.pubmed-link:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  function shouldSkipTextNode(textNode) {
    if (!textNode || !textNode.nodeValue) return true;

    const parent = textNode.parentElement;
    if (!parent) return true;

    if (SKIP_TAGS.has(parent.tagName)) return true;
    if (parent.closest("a, script, style, textarea, input, code, pre, noscript")) return true;

    return !PUBMED_REGEX.test(textNode.nodeValue);
  }

  function makePubMedAnchor(label, pmid) {
    const a = document.createElement("a");
    a.className = "pubmed-link";
    a.href = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = `Open PubMed record ${pmid}`;
    a.textContent = label;
    return a;
  }

  function linkifyTextNode(textNode) {
    const text = textNode.nodeValue;

    PUBMED_REGEX.lastIndex = 0;

    let match;
    let lastIndex = 0;
    let changed = false;

    const fragment = document.createDocumentFragment();

    while ((match = PUBMED_REGEX.exec(text)) !== null) {
      changed = true;

      const matchedText = match[0];
      const pmid = match[1];
      const start = match.index;
      const end = start + matchedText.length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      fragment.appendChild(makePubMedAnchor(matchedText, pmid));

      lastIndex = end;
    }

    if (!changed) return;

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function linkifyPubMedInElement(root) {
    if (!root) return;

    injectStyle();

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          PUBMED_REGEX.lastIndex = 0;
          return shouldSkipTextNode(node)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let node;

    while ((node = walker.nextNode())) {
      nodes.push(node);
    }

    nodes.forEach(linkifyTextNode);
  }

  function initPubMedLinkifier() {
    const root = document.querySelector("main") || document.body;

    linkifyPubMedInElement(root);

    let timer = null;

    const observer = new MutationObserver(function () {
      if (timer) window.clearTimeout(timer);

      timer = window.setTimeout(function () {
        linkifyPubMedInElement(root);
      }, 80);
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPubMedLinkifier);
  } else {
    initPubMedLinkifier();
  }
})();