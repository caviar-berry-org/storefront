import {
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
  type CSSProperties,
  type ElementType,
} from "react";

// Split during React rendering, so animation never mutates hydrated text nodes.
function words(children: ReactNode, index = { value: 0 }): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string")
      return child.split(/(\s+)/).map((word, i) =>
        /^\s+$/.test(word) ? (
          word
        ) : (
          <span className="wm" key={i}>
            <span
              className="w"
              style={{ "--i": index.value++ } as CSSProperties}
            >
              {word}
            </span>
          </span>
        ),
      );
    if (isValidElement<{ children?: ReactNode }>(child))
      return cloneElement(
        child as ReactElement<{ children?: ReactNode }>,
        {},
        words(child.props.children, index),
      );
    return child;
  });
}
export function SplitText({
  as: Tag = "h2",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className} data-split="">
      {words(children)}
    </Tag>
  );
}
