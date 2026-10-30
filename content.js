(() => {
  "use strict";

  /*
   * Octavo Project Comments Formatter
   * Version 1.1.0
   */

  const processedTextareas = new WeakSet();
  const histories = new WeakMap();

  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, character => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }

  function syncToOctavo(editor, textarea) {
    if (!editor || !textarea) return;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;

    setter.call(textarea, editor.innerHTML);

    textarea.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    textarea.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );

    textarea.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        key: "End",
        code: "End"
      })
    );
  }

  function getTextarea(editor) {
    const wrapper = editor.closest(".inh-wrapper");

    if (!wrapper) {
      return null;
    }

    return wrapper.querySelector(
      ".inh-original-textarea"
    );
  }

  function getHistory(editor) {
    let history = histories.get(editor);

    if (!history) {
      history = {
        undo: [],
        redo: [],
        lastHtml: editor.innerHTML,
        restoring: false
      };

      histories.set(editor, history);
    }

    return history;
  }

  function recordChange(editor, beforeHtml) {
    const history = getHistory(editor);
    const afterHtml = editor.innerHTML;

    if (beforeHtml === afterHtml) {
      return;
    }

    history.undo.push(beforeHtml);

    if (history.undo.length > 50) {
      history.undo.shift();
    }

    history.redo = [];
    history.lastHtml = afterHtml;

    updateHistoryButtons(editor);
  }

  function saveHistory(editor) {
    const history = getHistory(editor);

    if (history.restoring) {
      return;
    }

    const current = editor.innerHTML;

    if (current === history.lastHtml) {
      return;
    }

    history.undo.push(history.lastHtml);

    if (history.undo.length > 50) {
      history.undo.shift();
    }

    history.redo = [];
    history.lastHtml = current;

    updateHistoryButtons(editor);
  }

  function restoreHtml(editor, html) {
    const history = getHistory(editor);

    history.restoring = true;

    editor.innerHTML = html;
    history.lastHtml = html;

    history.restoring = false;

    syncToOctavo(
      editor,
      getTextarea(editor)
    );

    editor.focus();

    const range = document.createRange();

    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);

    updateHistoryButtons(editor);
  }

  function undo(editor) {
    const history = getHistory(editor);

    if (history.undo.length === 0) {
      return;
    }

    history.redo.push(editor.innerHTML);

    const previous = history.undo.pop();

    restoreHtml(editor, previous);
  }

  function redo(editor) {
    const history = getHistory(editor);

    if (history.redo.length === 0) {
      return;
    }

    history.undo.push(editor.innerHTML);

    const next = history.redo.pop();

    restoreHtml(editor, next);
  }

  function updateHistoryButtons(editor) {
    const wrapper = editor.closest(".inh-wrapper");

    if (!wrapper) {
      return;
    }

    const history = getHistory(editor);

    const undoButton = wrapper.querySelector(
      '[data-action="undo"]'
    );

    const redoButton = wrapper.querySelector(
      '[data-action="redo"]'
    );

    if (undoButton) {
      undoButton.disabled =
        history.undo.length === 0;
    }

    if (redoButton) {
      redoButton.disabled =
        history.redo.length === 0;
    }
  }

  function saveSelection(editor) {
    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (
      !editor.contains(
        range.commonAncestorContainer
      )
    ) {
      return;
    }

    if (!range.collapsed) {
      editor._inhSavedRange =
        range.cloneRange();
    }
  }

  function restoreSelection(editor) {
    const range = editor._inhSavedRange;

    if (!range) {
      return null;
    }

    try {
      const selection = window.getSelection();

      selection.removeAllRanges();
      selection.addRange(range);

      return range;
    } catch {
      return null;
    }
  }

  function selectNodeContents(editor, node) {
    const range = document.createRange();

    range.selectNodeContents(node);

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);

    editor._inhSavedRange =
      range.cloneRange();
  }

  function applyInlineFormatting(
    editor,
    tagName,
    attributes = {}
  ) {
    const range = restoreSelection(editor);

    if (
      !range ||
      range.collapsed
    ) {
      return;
    }

    const beforeHtml = editor.innerHTML;

    const element =
      document.createElement(tagName);

    Object.entries(attributes).forEach(
      ([name, value]) => {
        element.setAttribute(
          name,
          value
        );
      }
    );

    try {
      const contents =
        range.extractContents();

      element.appendChild(contents);

      range.insertNode(element);

      selectNodeContents(
        editor,
        element
      );

      recordChange(
        editor,
        beforeHtml
      );

      syncToOctavo(
        editor,
        getTextarea(editor)
      );
    } catch (error) {
      console.error(
        "Octavo Project Comments Formatter:",
        error
      );
    }
  }

  function stripInlineFormatting(root) {
    const formattingTags = [
      "STRONG",
      "B",
      "EM",
      "I",
      "U",
      "S",
      "STRIKE",
      "MARK",
      "FONT"
    ];

    const elements = [
      ...root.querySelectorAll("*")
    ];

    elements.forEach(element => {
      if (
        formattingTags.includes(
          element.tagName
        )
      ) {
        const parent =
          element.parentNode;

        if (!parent) {
          return;
        }

        while (
          element.firstChild
        ) {
          parent.insertBefore(
            element.firstChild,
            element
          );
        }

        parent.removeChild(
          element
        );

        return;
      }

      if (
        element.hasAttribute("style")
      ) {
        element.removeAttribute(
          "style"
        );
      }

      [
        "class",
        "color",
        "face",
        "size"
      ].forEach(attribute => {
        element.removeAttribute(
          attribute
        );
      });
    });
  }

  function cleanListItem(listItem) {
    const clone =
      listItem.cloneNode(true);

    stripInlineFormatting(clone);

    clone
      .querySelectorAll(
        "ul, ol"
      )
      .forEach(nestedList => {
        nestedList.remove();
      });

    return clone.innerHTML
      .replace(
        /<div[^>]*>/gi,
        "<br>"
      )
      .replace(
        /<\/div>/gi,
        ""
      )
      .replace(
        /<p[^>]*>/gi,
        "<br>"
      )
      .replace(
        /<\/p>/gi,
        ""
      )
      .replace(
        /^\s*<br>/i,
        ""
      )
      .trim();
  }

  function removeLists(editor) {
    const lists = [
      ...editor.querySelectorAll(
        "ul, ol"
      )
    ];

    lists.reverse().forEach(list => {
      const parent =
        list.parentNode;

      if (!parent) {
        return;
      }

      const items = [
        ...list.children
      ].filter(
        item =>
          item.tagName === "LI"
      );

      const fragments = [];

      items.forEach(item => {
        const html =
          cleanListItem(item);

        if (html) {
          fragments.push(html);
        }
      });

      const html =
        fragments.join("<br>");

      const temporary =
        document.createElement(
          "span"
        );

      temporary.innerHTML =
        html;

      while (
        temporary.firstChild
      ) {
        parent.insertBefore(
          temporary.firstChild,
          list
        );
      }

      list.remove();
    });

    editor
      .querySelectorAll(
        "ul p, ol p"
      )
      .forEach(paragraph => {
        const parent =
          paragraph.parentNode;

        if (!parent) {
          return;
        }

        const text =
          paragraph.textContent.trim();

        if (text) {
          parent.insertBefore(
            document.createTextNode(
              text
            ),
            paragraph
          );

          parent.insertBefore(
            document.createElement(
              "br"
            ),
            paragraph
          );
        }

        paragraph.remove();
      });

    editor
      .querySelectorAll(
        "ul, ol"
      )
      .forEach(list => {
        list.remove();
      });
  }

  function cleanNativeContent(editor) {
    editor
      .querySelectorAll(
        "[style], [class]"
      )
      .forEach(element => {
        element.removeAttribute(
          "style"
        );

        element.removeAttribute(
          "class"
        );
      });
  }

  function clearFormatting(editor) {
    const range =
      restoreSelection(editor);

    if (
      !range ||
      range.collapsed
    ) {
      return;
    }

    const beforeHtml =
      editor.innerHTML;

    const editorRange =
      document.createRange();

    editorRange.selectNodeContents(
      editor
    );

    const selectionCoversEditor =
      range.compareBoundaryPoints(
        Range.START_TO_START,
        editorRange
      ) <= 0 &&
      range.compareBoundaryPoints(
        Range.END_TO_END,
        editorRange
      ) >= 0;

    if (selectionCoversEditor) {
      stripInlineFormatting(
        editor
      );

      removeLists(editor);

      cleanNativeContent(
        editor
      );

      recordChange(
        editor,
        beforeHtml
      );

      syncToOctavo(
        editor,
        getTextarea(editor)
      );

      editor.focus();

      const newRange =
        document.createRange();

      newRange.selectNodeContents(
        editor
      );

      const selection =
        window.getSelection();

      selection.removeAllRanges();
      selection.addRange(newRange);

      editor._inhSavedRange =
        newRange.cloneRange();

      updateHistoryButtons(
        editor
      );

      return;
    }

    editor.focus();

    const selection =
      window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand(
      "removeFormat",
      false,
      null
    );

    const selectedElements = [
      ...editor.querySelectorAll("*")
    ].filter(element => {
      try {
        const elementRange =
          document.createRange();

        elementRange.selectNodeContents(
          element
        );

        return (
          range.compareBoundaryPoints(
            Range.END_TO_START,
            elementRange
          ) < 0 &&
          range.compareBoundaryPoints(
            Range.START_TO_END,
            elementRange
          ) > 0
        );
      } catch {
        return false;
      }
    });

    selectedElements.forEach(
      element => {
        element.removeAttribute(
          "style"
        );

        element.removeAttribute(
          "class"
        );

        [
          "color",
          "face",
          "size"
        ].forEach(attribute => {
          element.removeAttribute(
            attribute
          );
        });

        if (
          [
            "STRONG",
            "B",
            "EM",
            "I",
            "U",
            "S",
            "STRIKE",
            "MARK",
            "FONT"
          ].includes(
            element.tagName
          )
        ) {
          const parent =
            element.parentNode;

          if (!parent) {
            return;
          }

          while (
            element.firstChild
          ) {
            parent.insertBefore(
              element.firstChild,
              element
            );
          }

          parent.removeChild(
            element
          );
        }
      }
    );

    const containingLists = [
      ...editor.querySelectorAll(
        "ul, ol"
      )
    ].filter(list => {
      try {
        return (
          list.contains(
            range.commonAncestorContainer
          ) ||
          range.intersectsNode(list)
        );
      } catch {
        return false;
      }
    });

    containingLists.forEach(list => {
      const parent =
        list.parentNode;

      if (!parent) {
        return;
      }

      const items = [
        ...list.children
      ].filter(
        item =>
          item.tagName === "LI"
      );

      const fragments = [];

      items.forEach(item => {
        const html =
          cleanListItem(item);

        if (html) {
          fragments.push(html);
        }
      });

      const temporary =
        document.createElement(
          "span"
        );

      temporary.innerHTML =
        fragments.join("<br>");

      while (
        temporary.firstChild
      ) {
        parent.insertBefore(
          temporary.firstChild,
          list
        );
      }

      list.remove();
    });

    cleanNativeContent(
      editor
    );

    recordChange(
      editor,
      beforeHtml
    );

    syncToOctavo(
      editor,
      getTextarea(editor)
    );

    saveSelection(editor);

    updateHistoryButtons(
      editor
    );
  }

  function applyList(
    editor,
    command
  ) {
    const range =
      restoreSelection(editor);

    if (!range) {
      return;
    }

    const beforeHtml =
      editor.innerHTML;

    editor.focus();

    const selection =
      window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand(
      command,
      false,
      null
    );

    recordChange(
      editor,
      beforeHtml
    );

    syncToOctavo(
      editor,
      getTextarea(editor)
    );

    saveSelection(editor);
  }

  function createButton(
    label,
    title,
    action,
    dataAction = null
  ) {
    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "inh-button";

    button.title = title;

    button.setAttribute(
      "aria-label",
      title
    );

    button.innerHTML = label;

    if (dataAction) {
      button.dataset.action =
        dataAction;
    }

    button.addEventListener(
      "mousedown",
      event => {
        event.preventDefault();

        const wrapper =
          button.closest(
            ".inh-wrapper"
          );

        const editor =
          wrapper?.querySelector(
            ".inh-editor"
          );

        if (!editor) {
          return;
        }

        action(editor);

        updateHistoryButtons(
          editor
        );
      }
    );

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
      }
    );

    return button;
  }

  function createToolbar() {
    const toolbar =
      document.createElement("div");

    toolbar.className =
      "inh-toolbar";

    toolbar.setAttribute(
      "role",
      "toolbar"
    );

    toolbar.setAttribute(
      "aria-label",
      "Internal note formatting"
    );

    const textGroup =
      document.createElement("div");

    textGroup.className =
      "inh-toolbar-group";

    textGroup.append(
      createButton(
        "<strong>B</strong>",
        "Bold",
        editor =>
          applyInlineFormatting(
            editor,
            "strong"
          )
      ),

      createButton(
        '<span class="inh-italic-icon">I</span>',
        "Italic",
        editor =>
          applyInlineFormatting(
            editor,
            "em"
          )
      )
    );

    const highlightGroup =
      document.createElement("div");

    highlightGroup.className =
      "inh-toolbar-group";

    /*
     * Highlighter order:
     * Yellow → Orange → Red
     */
    highlightGroup.append(
      createButton(
        '<span class="inh-highlighter inh-highlighter-yellow"></span>',
        "Yellow highlight",
        editor =>
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #fff59d;"
            }
          )
      ),

      createButton(
        '<span class="inh-highlighter inh-highlighter-orange"></span>',
        "Orange highlight",
        editor =>
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #ffd08a;"
            }
          )
      ),

      createButton(
        '<span class="inh-highlighter inh-highlighter-red"></span>',
        "Red highlight",
        editor =>
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #ffb3b3;"
            }
          )
      )
    );

    const listGroup =
      document.createElement("div");

    listGroup.className =
      "inh-toolbar-group";

    listGroup.append(
      createButton(
        `
        <span class="inh-list-icon">
          <span class="inh-bullet-row">
            <span class="inh-bullet"></span>
            <span class="inh-list-line"></span>
          </span>
          <span class="inh-bullet-row">
            <span class="inh-bullet"></span>
            <span class="inh-list-line"></span>
          </span>
          <span class="inh-bullet-row">
            <span class="inh-bullet"></span>
            <span class="inh-list-line"></span>
          </span>
        </span>
        `,
        "Bulleted list",
        editor =>
          applyList(
            editor,
            "insertUnorderedList"
          )
      ),

      createButton(
        `
        <span class="inh-numbered-list-icon">
          <span class="inh-number-row">
            <span class="inh-number">1.</span>
            <span class="inh-number-line"></span>
          </span>
          <span class="inh-number-row">
            <span class="inh-number">2.</span>
            <span class="inh-number-line"></span>
          </span>
          <span class="inh-number-row">
            <span class="inh-number">3.</span>
            <span class="inh-number-line"></span>
          </span>
        </span>
        `,
        "Numbered list",
        editor =>
          applyList(
            editor,
            "insertOrderedList"
          )
      )
    );

    const historyGroup =
      document.createElement("div");

    historyGroup.className =
      "inh-toolbar-group";

    historyGroup.append(
      createButton(
        "↶",
        "Undo",
        editor =>
          undo(editor),
        "undo"
      ),

      createButton(
        "↷",
        "Redo",
        editor =>
          redo(editor),
        "redo"
      ),

      createButton(
        '<span class="inh-eraser-icon"></span>',
        "Clear formatting",
        editor =>
          clearFormatting(editor)
      )
    );

    toolbar.append(
      textGroup,
      highlightGroup,
      listGroup,
      historyGroup
    );

    return toolbar;
  }

  function enhanceField(textarea) {
    if (!textarea) {
      return;
    }

    if (
      processedTextareas.has(
        textarea
      )
    ) {
      return;
    }

    if (
      textarea.name !== "comment"
    ) {
      return;
    }

    const parent =
      textarea.closest(
        ".modal, [role='dialog'], form"
      );

    if (
      !isVisible(textarea) &&
      !parent
    ) {
      return;
    }

    const previous =
      textarea.previousElementSibling;

    if (
      previous?.classList.contains(
        "inh-wrapper"
      )
    ) {
      processedTextareas.add(
        textarea
      );

      return;
    }

    processedTextareas.add(
      textarea
    );

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "inh-wrapper";

    const toolbar =
      createToolbar();

    const editor =
      document.createElement("div");

    editor.className =
      "inh-editor";

    editor.contentEditable =
      "true";

    editor.setAttribute(
      "role",
      "textbox"
    );

    editor.setAttribute(
      "aria-multiline",
      "true"
    );

    editor.setAttribute(
      "data-placeholder",
      "Enter internal note..."
    );

    if (textarea.value) {
      const existing =
        textarea.value;

      if (
        /<[a-z][\s\S]*>/i.test(
          existing
        )
      ) {
        editor.innerHTML =
          existing;
      } else {
        editor.innerHTML =
          escapeHtml(
            existing
          ).replace(
            /\n/g,
            "<div>"
          ) + "</div>";
      }
    }

    textarea.classList.add(
      "inh-original-textarea"
    );

    textarea.style.display =
      "none";

    textarea.setAttribute(
      "aria-hidden",
      "true"
    );

    textarea.parentNode.insertBefore(
      wrapper,
      textarea
    );

    wrapper.append(
      toolbar,
      editor
    );

    getHistory(editor);

    updateHistoryButtons(
      editor
    );

    editor.addEventListener(
      "mouseup",
      () => {
        saveSelection(editor);
      }
    );

    editor.addEventListener(
      "keyup",
      event => {
        saveSelection(editor);

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "b"
        ) {
          event.preventDefault();

          const before =
            editor.innerHTML;

          restoreSelection(editor);

          document.execCommand(
            "bold",
            false,
            null
          );

          recordChange(
            editor,
            before
          );

          syncToOctavo(
            editor,
            textarea
          );

          saveSelection(editor);
        }

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "i"
        ) {
          event.preventDefault();

          const before =
            editor.innerHTML;

          restoreSelection(editor);

          document.execCommand(
            "italic",
            false,
            null
          );

          recordChange(
            editor,
            before
          );

          syncToOctavo(
            editor,
            textarea
          );

          saveSelection(editor);
        }
      }
    );

    editor.addEventListener(
      "input",
      () => {
        saveHistory(editor);

        syncToOctavo(
          editor,
          textarea
        );

        saveSelection(editor);
      }
    );

    editor.addEventListener(
      "blur",
      () => {
        syncToOctavo(
          editor,
          textarea
        );
      }
    );

    const form =
      textarea.closest("form");

    if (form) {
      form.addEventListener(
        "submit",
        () => {
          syncToOctavo(
            editor,
            textarea
          );
        },
        true
      );
    }
  }

  function scan() {
    document
      .querySelectorAll(
        'textarea[name="comment"]'
      )
      .forEach(
        textarea =>
          enhanceField(
            textarea
          )
      );
  }

  const observer =
    new MutationObserver(() => {
      scan();
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  scan();

  setInterval(
    scan,
    1000
  );
})();