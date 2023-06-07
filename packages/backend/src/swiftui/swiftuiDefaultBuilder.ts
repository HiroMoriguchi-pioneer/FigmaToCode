import { sliceNum } from "./../common/numToAutoFixed";
import { swiftuiBlur, swiftuiShadow } from "./builderImpl/swiftuiEffects";
import {
  swiftuiBorder,
  swiftuiCornerRadius,
} from "./builderImpl/swiftuiBorder";
import { swiftuiColorFromFills } from "./builderImpl/swiftuiColor";
import { swiftuiPadding } from "./builderImpl/swiftuiPadding";
import { swiftuiSize } from "./builderImpl/swiftuiSize";

import {
  swiftuiVisibility,
  swiftuiOpacity,
  swiftuiRotation,
  swiftuiBlendMode,
} from "./builderImpl/swiftuiBlend";
import {
  commonIsAbsolutePosition,
  getCommonPositionValue,
} from "../common/commonPosition";
import { Modifier, SwiftUIElement } from "./builderImpl/swiftuiParser";

export class SwiftuiDefaultBuilder {
  private readonly element: SwiftUIElement;

  constructor(kind: string = "") {
    this.element = new SwiftUIElement(kind);
  }

  private pushModifier(...args: (Modifier | null)[]): void {
    args.forEach((modifier) => {
      if (modifier) {
        this.element.addModifier(modifier);
      }
    });
  }

  commonPositionStyles(
    node: SceneNode & LayoutMixin & MinimalBlendMixin,
    optimizeLayout: boolean
  ): this {
    this.position(node, optimizeLayout);
    this.blend(node);
    return this;
  }

  blend(node: SceneNode & LayoutMixin & MinimalBlendMixin): this {
    this.pushModifier(
      swiftuiVisibility(node),
      swiftuiRotation(node),
      swiftuiOpacity(node),
      swiftuiBlendMode(node)
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

  position(node: SceneNode, optimizeLayout: boolean): this {
    if (commonIsAbsolutePosition(node, optimizeLayout)) {
      const { x, y } = getCommonPositionValue(node);
      const { centerX, centerY } = this.topLeftToCenterOffset(
        x,
        y,
        node,
        node.parent
      );

      this.pushModifier([
        `offset`,
        `x: ${sliceNum(centerX)}, y: ${sliceNum(centerY)}`,
      ]);
    }
    return this;
  }

  shapeBorder(node: SceneNode): this {
    const borders = swiftuiBorder(node);
    if (borders) {
      borders.forEach((border) => {
        console.log("border is ", border);
        this.element.addModifierMixed("overlay", border);
      });
    }
    return this;
  }

  shapeBackground(node: SceneNode): this {
    if ("fills" in node) {
      const fillColor = swiftuiColorFromFills(node.fills);
      if (fillColor) {
        this.pushModifier([`background`, fillColor]);
      }
    }
    return this;
  }

  shapeForeground(node: SceneNode): this {
    if (!("children" in node) || node.children.length === 0) {
      this.pushModifier([`foregroundColor`, ".clear"]);
    }
    return this;
  }

  cornerRadius(node: SceneNode): this {
    const corner = swiftuiCornerRadius(node);
    if (corner) {
      this.pushModifier([`cornerRadius`, corner]);
    }
    return this;
  }

  fillColor(node: MinimalFillsMixin): this {
    const fillColor = swiftuiColorFromFills(node.fills);
    if (fillColor) {
      this.pushModifier([`fill`, fillColor]);
    }

    return this;
  }

  effects(node: SceneNode): this {
    if (node.type === "GROUP") {
      return this;
    }

    this.pushModifier(swiftuiBlur(node), swiftuiShadow(node));

    return this;
  }

  size(node: SceneNode): this {
    const { width, height } = swiftuiSize(node);
    const sizes = [width, height].filter((d) => d);
    if (sizes.length > 0) {
      this.pushModifier([`frame`, sizes.join(", ")]);
    }

    return this;
  }

  autoLayoutPadding(node: SceneNode, optimizeLayout: boolean): this {
    if ("paddingLeft" in node) {
      this.pushModifier(
        swiftuiPadding(
          (optimizeLayout ? node.inferredAutoLayout : null) ?? node
        )
      );
    }
    return this;
  }

  build(indentLevel: number = 0): string {
    console.log("this.element", this.element.toString(-2));
    // this.element.element = kind;
    return this.element.toString(indentLevel);
  }
}