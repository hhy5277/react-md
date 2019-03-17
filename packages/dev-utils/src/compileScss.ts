import nodeSass from "node-sass";
import nodePostcss from "postcss";
import postcssPresetEnv from "postcss-preset-env";
import postcssFlexbugsFixes from "postcss-flexbugs-fixes";
import sorting from "postcss-sorting";
import cssnano from "cssnano";
import combineDuplicatedSelectors from "postcss-combine-duplicated-selectors";
import combineMediaQueries from "css-mqpacker";

import { rootNodeModules, src } from "./paths";
import { log, list } from "./utils";

export function compileScss(
  options: nodeSass.SyncOptions,
  exit: boolean = true
) {
  try {
    const { includePaths = [src] } = options;
    return nodeSass.renderSync({
      ...options,
      includePaths: [...includePaths, rootNodeModules],
    });
  } catch (e) {
    if (exit) {
      console.error(e.formatted);
      console.error();
      process.exit(1);
    } else {
      throw e;
    }
  }
}

export interface PostCSSOptions {
  production: boolean;
  srcFile: string;
  outFile: string;
}

export async function postcss(
  css: string,
  { production, srcFile, outFile }: PostCSSOptions
) {
  log("Running postcss with the following plugins:");
  log(
    list(
      [
        "postcss-preset-env",
        "postcss-flexbugs-fixes",
        "postcss-sorting",
        production && "cssnano",
        production && "postcss-combine-duplicated-selectors",
        production && "css-mqpacker",
      ].filter(Boolean)
    )
  );
  log();

  const result = await nodePostcss(
    [
      postcssPresetEnv({ stage: 3, autoprefixer: { flexbox: "no-2009" } }),
      postcssFlexbugsFixes(),
      sorting({
        order: ["custom-properties", "declarations"],
        "properties-order": "alphabetical",
        "unspecified-properties-position": "bottom",
      }),
      production && combineMediaQueries(),
      production && combineDuplicatedSelectors,
      production && cssnano({ preset: "default" }),
    ].filter(Boolean)
  ).process(css, {
    from: srcFile,
    to: outFile,
    map: !production && { inline: false },
  });

  checkForInvalidCSS(result.css);

  return result;
}

export function checkForInvalidCSS(css: string) {
  const matches = css.match(/.*rmd(-[a-z]+)+\(.*\n/);
  if (!matches) {
    return;
  }

  const matchContext = css.match(/(.*\n){0,3}.*rmd(-[a-z]+)+\(.*\n(.*\n){0,3}/);
  console.error(
    "There is invalid compiled css in this bundle. Please check the scss files"
  );
  console.error("to try to fix these issues.");
  console.error(list(matches.slice(0, matches.length - 1)));
  console.error();
  console.error(matchContext[0].trim());
  console.error();
  process.exit(1);
}

type HackedVariableValue = string | boolean | number | HackedVariable[];
export interface HackedVariable {
  name: string;
  value: HackedVariableValue;
}

function parseValue(value: HackedVariableValue) {
  if (value === "true" || value === "false") {
    return Boolean(value);
  } else if (value === "null") {
    return null;
  } else if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed.toString().length === value.length) {
      return parsed;
    }
  }

  return value;
}

function matchParen(s: string, count: number = 0) {
  const match = s.match(/\(|\)/);
  if (!match) {
    return s;
  }

  const i = match.index + 1;
  if (match[0] === ")") {
    if (count === 1) {
      return s.substring(0, i);
    }
    console.log("count:", count);
    return s.substring(0, i);
  }

  return s.substring(0, i) + matchParen(s.substring(i), count + 1);
}

function hackSCSSMapValues(mapValue: string) {
  let remaining = mapValue.substring(1, mapValue.length - 1);
  const values: HackedVariable[] = [];
  while (remaining.length) {
    const i = remaining.indexOf(": ");
    if (i === -1) {
      console.error(
        "Unable to hack a css variable correctly since no valid key/value split was found."
      );
      console.error("Original Map Value: ", mapValue);
      console.error("Remaining string: ", remaining);
      break;
    }

    const name = remaining.substring(0, i);
    remaining = remaining.substring(i + 2);
    let j =
      name === "font-family"
        ? remaining.search(/, [-a-z]+: /)
        : remaining.indexOf(",");
    if (j === -1) {
      j = remaining.length;
    }

    let value: HackedVariableValue = remaining.substring(0, j);
    if (value.startsWith("(")) {
      const mapString = matchParen(remaining);
      j = mapString.length;
      value = hackSCSSMapValues(mapString);
    } else if (value.includes("(")) {
      value = matchParen(remaining);
      j = (value as string).length;
    }

    value = parseValue(value);
    remaining = remaining.substring(j + 1).trim();
    values.push({ name, value });
  }

  return values;
}

export function hackSCSSVariableValue(
  scssVariable: any,
  packageName: string
): HackedVariable {
  const { name, value } = scssVariable.context;
  const prefix = `$${name}: `;

  try {
    const data = `@import 'src/mixins';
@error '${prefix}#{${value}}';
`;

    compileScss(
      {
        data,
        outputStyle: "expanded",
      },
      false
    );
  } catch (error) {
    const { message } = error;
    if (/Undefined variable |File to import not found/.test(message)) {
      console.error(`Variable hack error in ${packageName}`);
      console.error();
      console.error(error.message);
      console.error();
      process.exit(1);
    }

    let value = message.substring(prefix.length);
    if (/^\(.*\)$/.test(value)) {
      value = hackSCSSMapValues(value);
    }

    return {
      name,
      value: parseValue(value),
    };
  }
}