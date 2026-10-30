(() => {
  "use strict";

  const processedTextareas = new WeakSet();
  const savedSelections = new WeakMap();

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

    const html = editor.innerHTML;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;

    setter.call(textarea, html);

    textarea.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    textarea.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    textarea.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        key: "End",
        code: "End"
      })
    );
  }

  /*
   * Save the user's current text selection.
   */
  function saveSelection(editor) {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    /*
     * Only save selections that actually belong
     * to our editor.
     */
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    if (range.collapsed) {
      return;
    }

    savedSelections.set(
      editor,
      range.cloneRange()
    );
  }

  /*
   * Restore the previously saved selection.
   */
  function restoreSelection(editor) {
    const range = savedSelections.get(editor);

    if (!range) {
      return null;
    }

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);

    return range;
  }

  /*
   * Get the actual text editor belonging to a toolbar.
   */
  function getEditorFromButton(button) {
    const wrapper =
      button.closest(".inh-wrapper");

    if (!wrapper) return null;

    return wrapper.querySelector(".inh-editor");
  }

  /*
   * Get the original Octavo textarea belonging
   * to the same toolbar/editor.
   */
  function getTextareaFromEditor(editor) {
    const wrapper =
      editor?.closest(".inh-wrapper");

    if (!wrapper) return null;

    return wrapper.querySelector(
      ".inh-original-textarea"
    );
  }

  /*
   * Apply an inline element such as:
   *
   * <strong>
   * <em>
   * <span style="background-color: ...">
   */
  function applyInlineFormatting(
    editor,
    tagName,
    attributes = {}
  ) {
    const range = restoreSelection(editor);

    if (!range || range.collapsed) {
      return false;
    }

    const element =
      document.createElement(tagName);

    Object.entries(attributes).forEach(
      ([name, value]) => {
        element.setAttribute(name, value);
      }
    );

    try {
      /*
       * Extract the selected contents.
       */
      const contents =
        range.extractContents();

      element.appendChild(contents);

      /*
       * Put the newly-formatted content
       * back into the editor.
       */
      range.insertNode(element);

      /*
       * Select the newly-created element's contents
       * so subsequent formatting can be applied.
       */
      const newRange =
        document.createRange();

      newRange.selectNodeContents(element);

      const selection =
        window.getSelection();

      selection.removeAllRanges();
      selection.addRange(newRange);

      savedSelections.set(
        editor,
        newRange.cloneRange()
      );

      return true;
    } catch (error) {
      console.error(
        "Internal Note Helper formatting error:",
        error
      );

      return false;
    }
  }

  /*
   * Create a formatting button.
   */
  function createButton(
    label,
    title,
    action
  ) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "inh-button";
    button.title = title;
    button.setAttribute(
      "aria-label",
      title
    );

    button.innerHTML = label;

    /*
     * IMPORTANT:
     *
     * Prevent the button from stealing focus.
     * The saved Range is our backup, but preserving
     * the browser selection is still desirable.
     */
    button.addEventListener(
      "mousedown",
      event => {
        event.preventDefault();

        const editor =
          getEditorFromButton(button);

        if (!editor) return;

        action(editor);

        const textarea =
          getTextareaFromEditor(editor);

        if (textarea) {
          syncToOctavo(
            editor,
            textarea
          );
        }
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

  /*
   * Build the toolbar.
   */
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

    /*
     * Bold
     */
    toolbar.appendChild(
      createButton(
        "<strong>B</strong>",
        "Bold",
        editor => {
          applyInlineFormatting(
            editor,
            "strong"
          );
        }
      )
    );

    /*
     * Italic
     */
    toolbar.appendChild(
      createButton(
        "<em>I</em>",
        "Italic",
        editor => {
          applyInlineFormatting(
            editor,
            "em"
          );
        }
      )
    );

    /*
     * Yellow highlight
     */
    toolbar.appendChild(
      createButton(
        "🟨",
        "Yellow highlight",
        editor => {
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #fff59d;"
            }
          );
        }
      )
    );

    /*
     * Red highlight
     */
    toolbar.appendChild(
      createButton(
        "🟥",
        "Red highlight",
        editor => {
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #ffb3b3;"
            }
          );
        }
      )
    );

    /*
     * Orange highlight
     */
    toolbar.appendChild(
      createButton(
        "🟧",
        "Orange highlight",
        editor => {
          applyInlineFormatting(
            editor,
            "span",
            {
              style:
                "background-color: #ffd08a;"
            }
          );
        }
      )
    );

    /*
     * Bulleted list
     */
    toolbar.appendChild(
      createButton(
        "•",
        "Bulleted list",
        editor => {
          const range =
            restoreSelection(editor);

          if (!range) return;

          document.execCommand(
            "insertUnorderedList"
          );
        }
      )
    );

    /*
     * Numbered list
     */
    toolbar.appendChild(
      createButton(
        "1.",
        "Numbered list",
        editor => {
          const range =
            restoreSelection(editor);

          if (!range) return;

          document.execCommand(
            "insertOrderedList"
          );
        }
      )
    );

    /*
     * Remove formatting
     */
    toolbar.appendChild(
      createButton(
        "🧹",
        "Remove formatting",
        editor => {
          const range =
            restoreSelection(editor);

          if (!range) return;

          document.execCommand(
            "removeFormat"
          );
        }
      )
    );

    return toolbar;
  }

  /*
   * Enhance ONE Octavo comment textarea.
   */
  function enhanceField(textarea) {
    if (!textarea) return;

    if (
      processedTextareas.has(textarea)
    ) {
      return;
    }

    if (
      textarea.name !== "comment"
    ) {
      return;
    }

    if (!isVisible(textarea)) {
      return;
    }

    /*
     * Extra protection against duplicate
     * extension editors.
     */
    const previous =
      textarea.previousElementSibling;

    if (
      previous &&
      previous.classList.contains(
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

    /*
     * Wrapper
     */
    const wrapper =
      document.createElement("div");

    wrapper.className =
      "inh-wrapper";

    /*
     * Toolbar
     */
    const toolbar =
      createToolbar();

    /*
     * Rich text editor
     */
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

    /*
     * Load existing textarea content.
     */
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
          `<p>${escapeHtml(existing)
            .replace(
              /\n/g,
              "<br>"
            )}</p>`;
      }
    }

    /*
     * Hide original textarea.
     */
    textarea.classList.add(
      "inh-original-textarea"
    );

    textarea.style.display =
      "none";

    textarea.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * Insert our wrapper.
     */
    textarea.parentNode.insertBefore(
      wrapper,
      textarea
    );

    wrapper.append(
      toolbar,
      editor
    );

    /*
     * Save selection whenever the user
     * selects text in the editor.
     */
    editor.addEventListener(
      "mouseup",
      () => {
        saveSelection(editor);
      }
    );

    editor.addEventListener(
      "keyup",
      () => {
        saveSelection(editor);
      }
    );

    editor.addEventListener(
      "select",
      () => {
        saveSelection(editor);
      }
    );

    /*
     * Normal typing.
     */
    editor.addEventListener(
      "input",
      () => {
        syncToOctavo(
          editor,
          textarea
        );

        /*
         * Save the current selection after typing.
         */
        saveSelection(editor);
      }
    );

    /*
     * Keep textarea synchronized.
     */
    editor.addEventListener(
      "blur",
      () => {
        syncToOctavo(
          editor,
          textarea
        );
      }
    );

    /*
     * Final synchronization before form submission.
     */
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

  /*
   * Find comment fields.
   */
  function scan() {
    document
      .querySelectorAll(
        'textarea[name="comment"]'
      )
      .forEach(
        enhanceField
      );
  }

  /*
   * Octavo dynamically creates the modal,
   * so monitor the page.
   */
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

  /*
   * Initial scan.
   */
  scan();

  /*
   * Backup scan.
   */
  setInterval(
    scan,
    1000
  );
})();