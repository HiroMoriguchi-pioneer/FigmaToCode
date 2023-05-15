import {
  AltEllipseNode,
  AltFrameNode,
  AltRectangleNode,
  AltGroupNode,
  AltTextNode,
  AltSceneNode,
} from "../altNodes/altMixins";
import { generateWidgetCode, sliceNum } from "../common/numToAutoFixed";
import { retrieveTopFill } from "../common/retrieveFill";
import { FlutterDefaultBuilder } from "./flutterDefaultBuilder";
import { FlutterTextBuilder } from "./flutterTextBuilder";
import { indentString } from "../common/indentString";

let parentId = "";
let material = true;

export const flutterMain = (
  sceneNode: ReadonlyArray<AltSceneNode>,
  parentIdSrc: string = "",
  isMaterial: boolean = false
): string => {
  parentId = parentIdSrc;
  material = isMaterial;

  let result = flutterWidgetGenerator(sceneNode);

  // remove the last ','
  result = result.slice(0, -1);

  return result;
};

// todo lint idea: replace BorderRadius.only(topleft: 8, topRight: 8) with BorderRadius.horizontal(8)
const flutterWidgetGenerator = (
  sceneNode: ReadonlyArray<AltSceneNode>
): string => {
  let comp: string[] = [];

  // filter non visible nodes. This is necessary at this step because conversion already happened.
  const visibleSceneNode = sceneNode.filter((d) => d.visible);
  const sceneLen = visibleSceneNode.length;

  visibleSceneNode.forEach((node, index) => {
    if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
      comp.push(flutterContainer(node, ""));
    }
    //  else if (node.type === "VECTOR") {
    // comp = flutterVector(node);
    // }
    else if (node.type === "GROUP") {
      comp.push(flutterGroup(node));
    } else if (node.type === "FRAME") {
      comp.push(flutterFrame(node));
    } else if (node.type === "TEXT") {
      comp.push(flutterText(node));
    }

    if (index < sceneLen - 1) {
      // if the parent is an AutoLayout, and itemSpacing is set, add a SizedBox between items.
      // on else, comp += ""
      const spacing = addSpacingIfNeeded(node);
      if (spacing) {
        // comp += "\n";
        comp.push(spacing);
      }
    }
  });

  return comp.join(",\n") + ",";
};

const flutterGroup = (node: AltGroupNode): string => {
  return flutterContainer(
    node,
    generateWidgetCode("Stack", {
      children: `[${flutterWidgetGenerator(node.children)}]`,
    })
  );
};

const flutterContainer = (
  node: AltFrameNode | AltGroupNode | AltRectangleNode | AltEllipseNode,
  child: string
): string => {
  let propChild = "";

  let image = "";
  if ("fills" in node && retrieveTopFill(node.fills)?.type === "IMAGE") {
    // const url = `https://via.placeholder.com/${node.width}x${node.height}`;
    // image = `Image.network("${url}"),`;

    // Flutter Web currently can't render network images :(
    image = `FlutterLogo(size: ${Math.min(node.width, node.height)}),`;
  }

  if (child.length > 0 && image.length > 0) {
    const prop1 = generateWidgetCode("Positioned.fill", {
      child: child,
    });
    const prop2 = generateWidgetCode("Positioned.fill", {
      child: image,
    });

    propChild = generateWidgetCode("Stack", {
      children: `[${indentString(prop1 + prop2, 2)}\n]`,
    });
  } else if (child.length > 0) {
    propChild = child;
  } else if (image.length > 0) {
    propChild = image;
  }

  const builder = new FlutterDefaultBuilder(propChild)
    .createContainer(node)
    .blendAttr(node)
    .position(node, parentId);

  return builder.child;
};

const flutterText = (node: AltTextNode): string => {
  const builder = new FlutterTextBuilder();

  builder
    .createText(node)
    .blendAttr(node)
    .textAutoSize(node)
    .position(node, parentId);

  return builder.child;
};

const flutterStar = (node: AltTextNode): string => {
  const builder = new FlutterTextBuilder();

  builder
    .createText(node)
    .blendAttr(node)
    .textAutoSize(node)
    .position(node, parentId);

  return builder.child;
};

const flutterFrame = (node: AltFrameNode): string => {
  const children = flutterWidgetGenerator(node.children);

  // Ignoring when Frame has a single child was removed because Expanded only works in Row/Column and not in Container, so additional logic would be required elsewhere.
  if (node.layoutMode !== "NONE") {
    const rowColumn = makeRowColumn(node, children);
    return flutterContainer(node, rowColumn);
  } else {
    // node.layoutMode === "NONE" && node.children.length > 1
    // children needs to be absolute
    return flutterContainer(
      node,
      generateWidgetCode("Stack", {
        children: `[\n${indentString(children, 2)}\n]`,
      })
    );
  }
};

const makeRowColumn = (node: AltFrameNode, children: string): string => {
  // ROW or COLUMN
  const rowOrColumn = node.layoutMode === "HORIZONTAL" ? "Row" : "Column";

  return generateWidgetCode(rowOrColumn, {
    mainAxisSize:
      node.layoutGrow === 1 ? "MainAxisSize.max" : "MainAxisSize.min",
    mainAxisAlignment: getMainAxisAlignment(node),
    crossAxisAlignment: getCrossAxisAlignment(node),
    children: `[\n${indentString(children, 2)}\n]`,
  });
};

const getMainAxisAlignment = (node: AltFrameNode): string => {
  switch (node.primaryAxisAlignItems) {
    case "MIN":
      return "MainAxisAlignment.start";
    case "CENTER":
      return "MainAxisAlignment.center";
    case "MAX":
      return "MainAxisAlignment.end";
    case "SPACE_BETWEEN":
      return "MainAxisAlignment.spaceBetween";
  }
};

const getCrossAxisAlignment = (node: AltFrameNode): string => {
  switch (node.counterAxisAlignItems) {
    case "MIN":
      return "CrossAxisAlignment.start";
    case "CENTER":
      return "CrossAxisAlignment.center";
    case "MAX":
      return "CrossAxisAlignment.end";
  }
};

// TODO Vector support in Flutter is complicated. Currently, AltConversion converts it in a Rectangle.

const addSpacingIfNeeded = (node: AltSceneNode): string => {
  if (node.parent?.type === "FRAME" && node.parent.layoutMode !== "NONE") {
    // check if itemSpacing is set and if it isn't the last value.
    // Don't add the SizedBox at last value. In Figma, itemSpacing CAN be negative; here it can't.
    if (node.parent.itemSpacing > 0) {
      if (node.parent.layoutMode === "HORIZONTAL") {
        return generateWidgetCode("SizedBox", {
          width: sliceNum(node.parent.itemSpacing),
        });
      } else {
        // node.parent.layoutMode === "VERTICAL"
        return generateWidgetCode("SizedBox", {
          height: sliceNum(node.parent.itemSpacing),
        });
      }
    }
  }
  return "";
};