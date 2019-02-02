import React, {
  forwardRef,
  FunctionComponent,
  HTMLAttributes,
  KeyboardEvent,
} from "react";
import { withStates } from "@react-md/states";
import { IWithForwardedRef, omit } from "@react-md/utils";

import {
  IButtonThemeProps,
  ButtonTheme,
  ButtonThemeType,
  ButtonType,
} from "./types.d";
import buttonThemeClassNames from "./buttonThemeClassNames";

export interface IFakeButtonProps
  extends IButtonThemeProps,
    HTMLAttributes<HTMLDivElement> {}

export interface IFakeButtonDefaultProps {
  disabled: boolean;
  theme: ButtonTheme;
  themeType: ButtonThemeType;
  buttonType: ButtonType;
  role: string;
  tabIndex: number;
}

export type FakeButtonWithDefaultProps = IFakeButtonProps &
  IFakeButtonDefaultProps &
  IWithForwardedRef<HTMLDivElement>;

/**
 * Need to remove the event listeners when the disabled prop
 * is enabled since there is no "real" disabled state built
 * into divs. Instead we will need to fake it programatically
 * by setting `aria-disabled="true"` and removing the event
 * listeners from the div.
 */
const EVENT_LISTENERS = [
  "onKeyUp",
  "onKeyPress",
  "onMouseDown",
  "onMouseUp",
  "onMouseOver",
  "onMouseEnter",
  "onMouseLeave",
  "onTouchStart",
  "onTouchMove",
  "onTouchEnd",
];

/**
 * The `FakeButton` is used for places where you need an element to interact
 * like a button, but want to have separate clickable children in the button
 * or "advanced" html of using nested `<div>`s since it is _technically_
 * invalid HTML to have `<div>`s as a descendant of a button.
 *
 * This component will render as an accessible "button" div by following the
 * button role specifications of:
 * - apply the button role to the div
 * - applying a tab index of 0 so it is keyboard focusable
 * - attaching a keydown event listener to click and the div when the user
 *   presses space or enter
 * - apply aria-disable="true" when the `disabled` prop has been enabled and
 *   removing all event listeners until it is enabled again.
 *
 * @see https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element
 * @see https://html.spec.whatwg.org/multipage/dom.html#phrasing-content-2
 */
const FakeButton: FunctionComponent<
  IFakeButtonProps & IWithForwardedRef<HTMLDivElement>
> = providedProps => {
  const {
    theme: propTheme,
    themeType,
    buttonType,
    children,
    forwardedRef,
    disabled,
    tabIndex,
    onKeyDown,
    ...props
  } = providedProps as FakeButtonWithDefaultProps;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (onKeyDown) {
      onKeyDown(event);
    }

    const { key } = event;
    const isSpace = key === " ";
    if (isSpace || key === "Enter") {
      if (isSpace) {
        event.preventDefault();
      }

      event.currentTarget.click();
    }
  }

  return (
    <div
      aria-disabled={disabled ? "true" : undefined}
      {...(disabled ? omit(props, EVENT_LISTENERS) : props)}
      ref={forwardedRef}
      className={buttonThemeClassNames(providedProps)}
      tabIndex={disabled ? undefined : tabIndex}
      onKeyDown={disabled ? undefined : handleKeyDown}
    >
      {children}
    </div>
  );
};

const defaultProps: IFakeButtonDefaultProps = {
  tabIndex: 0,
  role: "button",
  disabled: false,
  theme: "primary",
  themeType: "flat",
  buttonType: "text",
};

FakeButton.defaultProps = defaultProps;

if (process.env.NODE_ENV !== "production") {
  // there's a problem with forwardedRef components that set the `displayName` to `undefined`
  FakeButton.displayName = "FakeButton";

  let PropTypes = null;
  try {
    PropTypes = require("prop-types");
  } catch (e) {}

  if (PropTypes) {
    FakeButton.propTypes = {
      tabIndex: PropTypes.number,
      role: PropTypes.string,
      className: PropTypes.string,
      theme: PropTypes.oneOf([
        "clear",
        "primary",
        "secondary",
        "warning",
        "error",
      ]),
      themeType: PropTypes.oneOf(["flat", "outline", "contained"]),
      buttonType: PropTypes.oneOf(["text", "icon"]),
      disabled: PropTypes.bool,
      children: PropTypes.node,
    };
  }
}

const FakeButtonWithStates = withStates(FakeButton);

export default forwardRef<HTMLDivElement, IFakeButtonProps>((props, ref) => (
  <FakeButtonWithStates {...props} forwardedRef={ref} />
));
