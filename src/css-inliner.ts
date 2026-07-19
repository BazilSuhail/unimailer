function parseStyleBlock(css: string): Array<{ selector: string; declarations: string }> {
  const rules: Array<{ selector: string; declarations: string }> = [];
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();

  let depth = 0;
  let current = "";

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (ch === "{") {
      depth++;
      current += ch;
    } else if (ch === "}") {
      depth--;
      current += ch;
      if (depth === 0) {
        const match = current.match(/^([^{:]+)\{([^}]*)\}$/);
        if (match) {
          const selector = match[1]!.trim();
          const declarations = match[2]!.trim();
          if (selector && declarations) {
            rules.push({ selector, declarations });
          }
        }
        current = "";
      }
    } else {
      current += ch;
    }
  }

  return rules;
}

function selectorMatchesElement(
  selector: string,
  tag: string,
  classes: string[],
  id: string | null,
): boolean {
  const sel = selector.trim().toLowerCase();

  if (sel.startsWith("#")) {
    return id === sel.slice(1);
  }

  if (sel.startsWith(".")) {
    const className = sel.slice(1);
    return classes.includes(className);
  }

  if (sel === tag) {
    return true;
  }

  if (sel.includes(".")) {
    const [tagPart, classPart] = sel.split(".", 2) as [string, string];
    return tag === tagPart && classes.includes(classPart);
  }

  if (sel.includes("#")) {
    const [tagPart, idPart] = sel.split("#", 2) as [string, string];
    return tag === tagPart && id === idPart;
  }

  return false;
}

function applyInlineStyles(
  html: string,
  rules: Array<{ selector: string; declarations: string }>,
): string {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)(\/?)>/g,
    (match: string, tagName: string, attrs: string, selfClose: string) => {
      const tag = tagName.toLowerCase();
      const classesMatch = attrs.match(/class="([^"]*)"/);
      const classes = classesMatch ? classesMatch[1]!.split(/\s+/) : [];
      const idMatch = attrs.match(/id="([^"]*)"/);
      const id = idMatch ? idMatch[1]! : null;

      const matchingDeclarations: string[] = [];
      for (const rule of rules) {
        if (selectorMatchesElement(rule.selector, tag, classes, id)) {
          matchingDeclarations.push(rule.declarations);
        }
      }

      if (matchingDeclarations.length === 0) {
        return match;
      }

      const newStyles = matchingDeclarations.join(" ");
      const existingStyleMatch = attrs.match(/\s+style="([^"]*)"/);

      let newAttrs: string;
      if (existingStyleMatch) {
        const existing = existingStyleMatch[1]!;
        newAttrs = attrs.replace(
          /\s+style="[^"]*"/,
          ` style="${existing} ${newStyles}"`,
        );
      } else {
        newAttrs = `${attrs} style="${newStyles}"`;
      }

      return `<${tagName}${newAttrs}${selfClose}>`;
    },
  );
}

export function inlineCss(html: string): string {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let allRules: Array<{ selector: string; declarations: string }> = [];
  let cleanedHtml = html;

  cleanedHtml = cleanedHtml.replace(styleRegex, (_match, css: string) => {
    const rules = parseStyleBlock(css);
    allRules = allRules.concat(rules);
    return "";
  });

  if (allRules.length === 0) {
    return html;
  }

  cleanedHtml = applyInlineStyles(cleanedHtml, allRules);

  return cleanedHtml;
}
