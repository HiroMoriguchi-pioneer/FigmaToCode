import { sliceNum } from "../common/numToAutoFixed";
import { androidShadow } from "./builderImpl/androidEffects";
import { androidBackground, androidSolidColor } from "./builderImpl/androidColor";
import { androidPadding } from "./builderImpl/androidPadding";
import { androidSize } from "./builderImpl/androidSize";

import {
  androidVisibility,
  androidOpacity,
  androidRotation,
} from "./builderImpl/androidBlend";
import { getCommonPositionValue } from "../common/commonPosition";
import { Modifier, androidElement } from "./builderImpl/androidParser";
import { AndroidType, androidNameParser, fmtId } from "./builderImpl/androidNameParser";
import { globalTextStyleSegments } from "../altNodes/altConversion";

export const isAbsolutePosition = (
  node: SceneNode,
  optimizeLayout: boolean
) => {
  // No position when parent is inferred auto layout.
  if (
    optimizeLayout &&
    node.parent &&
    "layoutMode" in node.parent &&
    node.parent.inferredAutoLayout !== null
  ) {
    return false;
  }

  if ("layoutAlign" in node) {
    if (!node.parent || node.parent === undefined) {
      return true;
    }

    const parentLayoutIsNone =
      "layoutMode" in node.parent && node.parent.layoutMode === "NONE";
    const hasNoLayoutMode = !("layoutMode" in node.parent);

    if (
      node.layoutPositioning === "ABSOLUTE" ||
      parentLayoutIsNone ||
      hasNoLayoutMode
    ) {
      return true;
    }
  }
  return false;
};

export function resourceName(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/);
  const snakeCaseWords = words.map((word, index) => {
    if (index === 0) {
      const cleanedWord = word.replace(/^[^a-zA-Z]+/g, "");
      return cleanedWord.charAt(0).toLowerCase() + cleanedWord.slice(1);
    }
    return word;
  });
  return snakeCaseWords.join("_");
}

export function resourceLowerCaseName(name: string): string {
  const words = name.toLocaleLowerCase().split(/[^a-zA-Z0-9]+/);
  const snakeCaseWords = words.map((word, index) => {
    if (index === 0) {
      const cleanedWord = word.replace(/^[^a-zA-Z]+/g, "");
      return cleanedWord.charAt(0) + cleanedWord.slice(1);
    }
    return word;
  });
  return snakeCaseWords.join("_");
}

export class androidDefaultBuilder {
  element: androidElement;

  constructor(kind: string = "", stack: string = "") {
    this.element = !stack ? new androidElement(kind) : new androidElement(kind, [["_CHILD",stack]]);
  }

  pushModifier(...args: (Modifier | null)[]): void {
    args.forEach((modifier) => {
      if (modifier) {
        this.element.addModifier(modifier);
      }
    });
  }

  commonPositionStyles(node: SceneNode, optimizeLayout: boolean): this {
    this.position(node, optimizeLayout);
    if ("layoutAlign" in node && "opacity" in node) {
      this.blend(node);
    }
    return this;
  }

  blend(node: SceneNode & LayoutMixin & MinimalBlendMixin): this {
    this.pushModifier(
      androidVisibility(node),
      androidRotation(node),
      androidOpacity(node)
    );

    return this;
  }

  topLeftToCenterOffset(
    x: number,
    y: number,
    node: SceneNode,
    parent: (BaseNode & ChildrenMixin) | null
  ): { centerX: number; centerY: number } {
    if (!parent || !("width" in parent)) {
      return { centerX: 0, centerY: 0 };
    }
    // Find the child's center coordinates
    const centerX = x + node.width / 2;
    const centerY = y + node.height / 2;

    // Calculate the center-based offset
    const centerBasedX = centerX - parent.width / 2;
    const centerBasedY = centerY - parent.height / 2;

    return { centerX: centerBasedX, centerY: centerBasedY };
  }

  position(node: SceneNode & BaseFrameMixin, optimizeLayout: boolean): this {
    const { x, y } = getCommonPositionValue(node);
    const parentType = androidNameParser(node.parent?.name).type
    const hasLinearLayoutParent = parentType === AndroidType.linearLayout
    const layoutPosition = `android:${hasLinearLayoutParent ? "layout_margin" : "padding"}`

    if ('constraints' in node && !hasLinearLayoutParent && node.parent && (node.x > 0 || node.y > 0)) {
      let isStartG: boolean;
      let isTopG: boolean;
      if (('width' in node.parent) && node.constraints.horizontal === 'MAX') {
        const pos = node.parent.width - node.width - x;
        this.pushModifier(['android:layout_marginEnd',`${sliceNum(pos)}dp`]);
        isStartG = false;
      } else {
        this.pushModifier(['android:layout_marginStart',`${sliceNum(x)}dp`]);
        isStartG = true;
      }

      if (('height' in node.parent) && node.constraints.vertical === 'MAX') {
        const pos = node.parent.height - node.height - y;
        this.pushModifier(['android:layout_marginBottom',`${sliceNum(pos)}dp`]);
        isTopG = false;
      } else {
        this.pushModifier(['android:layout_marginTop',`${sliceNum(y)}dp`]);
        isTopG = true;
      }

      if (!(isStartG && isTopG)) {
        const gravity = `${isStartG ? "start" : "end"}|${isTopG ? "top" : "bottom"}`
        this.pushModifier(['android:layout_gravity', gravity]);
      }
    } else {
      if (node.paddingTop > 0) {
        this.pushModifier([`${layoutPosition}Top`,`${node.paddingTop}dp`]);
      }
      if (node.paddingBottom > 0) {
        this.pushModifier([`${layoutPosition}Bottom`,`${node.paddingBottom}dp`]);
      }
      if (node.paddingRight > 0) {
        this.pushModifier([`${layoutPosition}End`,`${node.paddingRight}dp`]);
      }
      if (node.paddingLeft > 0) {
        this.pushModifier([`${layoutPosition}Start`,`${node.paddingLeft}dp`]);
      }
    }

    return this;
  }

  shapeBackground(node: SceneNode): this {
    this.element.addModifier(androidBackground(node));
    return this;
  }

  effects(node: SceneNode): this {
    if (node.type === "GROUP") {
      return this;
    }

    this.pushModifier(androidShadow(node));

    return this;
  }

  size(node: SceneNode, optimize: boolean): this {
    const { width, height, weight} = androidSize(node, optimize);
    if (width) {
      this.pushModifier(['android:layout_width', `${width}`]);
    }
    if (height) {
      this.pushModifier(['android:layout_height', `${height}`]);
    }
    if (weight) {
      this.pushModifier(['android:layout_weight', `1`]);
    }
    return this;
  }

  spaceSize(node: SceneNode): this {
    if ((node.parent?.type === "COMPONENT" || node.parent?.type === "INSTANCE" || node.parent?.type === "FRAME") ) {
      if (node.parent.layoutMode === "VERTICAL") {
        this.pushModifier(['android:layout_width', `match_parent`])
        this.pushModifier(['android:layout_height', `${node.parent.itemSpacing}dp`])
      } else if (node.parent.layoutMode === "HORIZONTAL") {
        this.pushModifier(['android:layout_width', `${node.parent.itemSpacing}dp`])
        this.pushModifier(['android:layout_height', `match_parent`])
      }
    }

    return this;
  }
  
  autoLayoutPadding(node: SceneNode, optimizeLayout: boolean): this {
    if ("paddingLeft" in node) {
      this.pushModifier(
        androidPadding(
          (optimizeLayout ? node.inferredAutoLayout : null) ?? node
        )
      );
    }
    return this;
  }

  setId(node: SceneNode): this {
    if ("name" in node && node.name ) {
      let id = androidNameParser(node.name).id
      if (id !== "") {
        this.pushModifier(['android:id', `@+id/${fmtId(id)}`]);
      } 
    }
    return this;
  }

  setText(node: TextNode | undefined, isPlaceholder = false): this {
    if (!node) { return this }
    const segments = globalTextStyleSegments[node.id];
    if (segments) {
      const segment = segments[0];

      this.element.addModifier([isPlaceholder ? 'android:hint' : 'android:text', `@string/${node.name}`])
      this.pushModifier(
        ['android:textColor', this.textColor(segment.fills)],
        ['android:includeFontPadding', 'false'],
        ["android:textAppearance", `@style/text_${segment.fontSize}_${segment.fontWeight}`]
      )
    }

    if (node != undefined && "textAlignHorizontal" in node) {
      let hAlign = "";
      switch (node.textAlignHorizontal) {
        case "LEFT":
          hAlign = "textStart"
          break;
        case "RIGHT":
          hAlign = "textEnd"
          break;
        default:
          hAlign = "center"
      }
      this.pushModifier(["android:textAlignment", hAlign])
    }
    return this;
  }

  textColor(fills: Paint[]): string {
    const fillColor = androidSolidColor(fills);
    if (fillColor) {
      return fillColor;
    }
    return "";
  }

  build(indentLevel: number = 0): string {
    // this.element.element = kind;
    return this.element.toString(indentLevel);
  }
}
