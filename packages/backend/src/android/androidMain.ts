import { compactProp, indentString } from "../common/indentString";
import { className, sliceNum } from "../common/numToAutoFixed";
import { androidBackground, androidCornerRadius } from "./builderImpl/androidColor";
import { androidTextBuilder } from "./androidTextBuilder";
import { androidDefaultBuilder } from "./androidDefaultBuilder";
import { PluginSettings } from "../code";
import { commonSortChildrenWhenInferredAutoLayout } from "../common/commonChildrenOrder";
import { androidShadow } from "./builderImpl/androidEffects";
import { TextNode } from "../altNodes/altMixins2";
import { androidSize } from "./builderImpl/androidSize";
import { AndroidType, androidNameParser } from "./builderImpl/androidNameParser";

let localSettings: PluginSettings;
let previousExecutionCache: string[];

const getPreviewTemplate = (name: string, injectCode: string): string =>
`<?xml version="1.0" encoding="utf-8"?>
<FrameLayout
  xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:app="http://schemas.android.com/apk/res-auto"
  android:layout_width="match_parent"
  android:layout_height="match_parent">
    ${indentString(injectCode, 4).trimStart()}
</FrameLayout>
`;

export const androidMain = (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings
): string => {
  localSettings = settings;
  previousExecutionCache = [];
  let result = androidWidgetGenerator(sceneNode, 0);

  switch (localSettings.androidGenerationMode) {
    case "snippet":
      return result;
    case "preview":
      // result = generateWidgetCode("Column", { children: [result] });
      return getPreviewTemplate(className(sceneNode[0].name), result);
  }

  // remove the initial \n that is made in Container.
  if (result.length > 0 && result.startsWith("\n")) {
    result = result.slice(1, result.length);
  }

  return result;
};

const androidWidgetGenerator = (
  sceneNode: ReadonlyArray<SceneNode>,
  indentLevel: number
): string => {
  const visibleSceneNode = sceneNode.filter((d) => d.visible);
  // filter non visible nodes. This is necessary at this step because conversion already happened.
  let comp: string[] = [];
  let compXml: string[] = [];
  let listItemCount: number = 0

  visibleSceneNode.forEach((node, index) => {
    const parentType = androidNameParser(node.parent?.name).type
    const isLinearLayout = parentType === AndroidType.linearLayout
    const hasStackParent = node.parent?.type === "COMPONENT" || node.parent?.type === "INSTANCE" || node.parent?.type === "FRAME"
    const isFirstItem = node.parent?.children[0] === node

    if (isLinearLayout && !isFirstItem && hasStackParent && node.parent.itemSpacing !== 0) {
      comp.push(androidLinearSpace(node));
    }

    switch (node.type) {
      case "COMPONENT":
      case "INSTANCE":
        switch (androidNameParser(node.name).type) {
          case AndroidType.list:
            comp.push(androidComponent(node, indentLevel));
            compXml.push(`\n\n<!-- ${node.name}_item.xml -->`)
            compXml.push(androidWidgetGenerator(node.children, indentLevel));
            break;
          case AndroidType.listItem:
            if (listItemCount != 0) break;
            comp.push(androidComponent(node, indentLevel));
            listItemCount = 1
            break;
          default:
            comp.push(androidComponent(node, indentLevel));
            break;
        }
        break;
      case "ELLIPSE":
      case "LINE":
        comp.push(androidContainer(node));
        break;
      case "FRAME":
      case "COMPONENT_SET":
        if (androidNameParser(node.name).type === AndroidType.linearLayout) {
          comp.push(androidComponent(node, indentLevel))
        }
        comp.push(androidFrame(node, indentLevel));
        break;
      case "TEXT":
        comp.push(androidText(node));
        break;
      case "RECTANGLE":
        if (node.isAsset) {
          comp.push(androidImage(node))
        }
        else {
          comp.push(androidContainer(node));
        }
      break;
      default:
      break;
    }
  });

  return comp.join("\n") + compXml.join("\n");
};

// properties named propSomething always take care of ","
// sometimes a property might not exist, so it doesn't add ","
export const androidContainer = (
  node: SceneNode,
  stack: string = ""
): string => {
  // ignore the view when size is zero or less
  // while technically it shouldn't get less than 0, due to rounding errors,
  // it can get to values like: -0.000004196293048153166
  if (node.width < 0 || node.height < 0) {
    return stack;
  }

  let kind = "";
  if (node.type === "RECTANGLE" && node.isAsset) {
    kind = "ImageView";
  } else if (node.type === "RECTANGLE" || node.type === "LINE" || node.type === "ELLIPSE") {
    kind = "View";
  }

  const result = new androidDefaultBuilder(kind,stack)
    .autoLayoutPadding(node, localSettings.optimizeLayout)
    .size(node, localSettings.optimizeLayout)
    .shapeBackground(node)
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .effects(node)
    .setId(node)
    .build(kind === stack ? -2 : 0);

  return result;
};


const androidView = (node: SceneNode & BaseFrameMixin): string => {
  const childImage= node.children.filter((child: { type: string; }) => child.type == "RECTANGLE" || child.type == "GROUP")[0]
  const isAsset = ("isAsset" in childImage && childImage.isAsset) || childImage.type === "GROUP"

  const result = new androidDefaultBuilder(isAsset ? "ImageView":"View")
    .setId(node)
    .position(node,localSettings.optimizeLayout)
    .size(node,localSettings.optimizeLayout);

  if (isAsset) {
    result.element.addModifier(["android:src",`@drawable/${childImage.name}`]);
    result.element.addModifier(["android:contentDescription",`@string/STR_MSG_IMAGEVIEW_CONTENT_DESCRIPTION`]);
  }
  result.pushModifier(androidShadow(childImage));
  result.element.addModifier(androidBackground(childImage));
  result.element.addModifier(["android:scaleType",'fitXY']);

  return result.build(0);
};

const androidLinearSpace = (node: SceneNode): string => {
  const result = new androidDefaultBuilder("Space")
    .spaceSize(node)
    
  previousExecutionCache.push(result.build());

  return result
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .build();
};

const androidText = (textNode: SceneNode & TextNode, node: SceneNode | null = null): string => {
  const result = new androidTextBuilder()
    .createText(textNode)
    .setId(node ? node : textNode)
    .position(node ? node : textNode, localSettings.optimizeLayout)
    .size(node ? node : textNode, localSettings.optimizeLayout);

  result.pushModifier(androidShadow(textNode));
  previousExecutionCache.push(result.build());

  return result
    .commonPositionStyles(textNode, localSettings.optimizeLayout)
    .build();
};

const androidImage = (node: RectangleNode | VectorNode): string => {
  const result = new androidDefaultBuilder("ImageView","")
    .setId(node)
    .position(node,localSettings.optimizeLayout)
    .size(node,localSettings.optimizeLayout);

  result.element.addModifier(["android:contentDescription",`@string/STR_MSG_IMAGEVIEW_CONTENT_DESCRIPTION`]);
  if ("name" in node && node.name) {
    result.element.addModifier(["app:srcCompat",`@drawable/${node.name}`]);
  }
  result.pushModifier(androidShadow(node));
  result.element
    .addModifier(["android:scaleType",'fitXY']);

  return result.build(0);
};

const androidButton = (node: SceneNode & BaseFrameMixin, setFrameLayout: boolean = false): string => {
  const childImage = node.children.filter((child: { type: string; }) => child.type == "RECTANGLE" || child.type == "GROUP")[0]
  const isAsset = ("isAsset" in childImage && childImage.isAsset) || childImage.type === "GROUP"
  const hasPadding = childImage.width !== node.width && childImage.height !== node.height
  let childText: SceneNode & TextNode | undefined = undefined
  if (node.children.filter(child => androidNameParser(child.name).type === AndroidType.text).length !== 0) {
    childText = node.children.filter((child): child is SceneNode & BaseFrameMixin => 
      androidNameParser(child.name).type === AndroidType.text
    )[0].children.filter((child): child is SceneNode & BaseFrameMixin =>
      androidNameParser(child.name).type === AndroidType.frameLayout
    )[0].children.filter((child): child is SceneNode & TextNode => child.type === "TEXT")[0]
  }
  
  const result = new androidDefaultBuilder(isAsset ? "ImageButton" : "Button")
    .setText(childText)
    .size(childImage,localSettings.optimizeLayout);

  if (hasPadding && !setFrameLayout) {
    const stack = createDirectionalStack(androidButton(node, true), node.name, node, true)
    return androidContainer(node, stack)
  } else if (!hasPadding) {
    result.setId(node)
  }

  if (isAsset) {
    result.element.addModifier(["android:src", `@drawable/${childImage.name}`]);
    result.element.addModifier(["android:background", "@color/clearColor"]);
  } else {
    result.element.addModifier(androidBackground(childImage))
  }

  if (hasPadding) {
    result.element.addModifier(["android:layout_gravity", "center"])
  } else {
    result.position(node, localSettings.optimizeLayout)
  }

  result.pushModifier(androidShadow(childImage));
  
  return result.build(0);
};

const androidRadioButton = (node: SceneNode & BaseFrameMixin): string => {
  const result = new androidDefaultBuilder("RadioButton")
    .setId(node)
    .size(node, localSettings.optimizeLayout)
    .position(node,localSettings.optimizeLayout);

  if (node.name.split("_")[2] === "checked") {
    result.pushModifier(["android:checked", "true"])
  }

  result.pushModifier(["android:onClick", "onRadioButtonClicked"])
  result.element.addModifier(androidBackground(node))
  result.pushModifier(androidShadow(node));
  
  return result.build(0);
};

const androidList = (node: SceneNode & BaseFrameMixin): string => {

  const result = new androidDefaultBuilder("androidx.recyclerview.widget.RecyclerView", "")
    .setId(node)
    .position(node,localSettings.optimizeLayout)
    .size(node,localSettings.optimizeLayout);

  result.element.addModifier(androidBackground(node))
  result.pushModifier(androidShadow(node));
  result.element.addModifier(["tools:listitem", `@layout/${node.name}_item`])
  return result.build(0);
};

const androidListItem = (node: SceneNode & BaseFrameMixin, indentLevel: number): string => {

  const children = widgetGeneratorWithLimits(
    node,
    node.children.length > 1 ? indentLevel + 1 : indentLevel
  );

  const idName = `${node.name}`
  const anyStack = createDirectionalStack(children, idName, node);
  return androidContainer(node, anyStack);
};

const androidSwitch = (node: SceneNode & BaseFrameMixin): string => {

  const result = new androidDefaultBuilder("Switch")
    .setId(node)
    .position(node,localSettings.optimizeLayout)
    .size(node,localSettings.optimizeLayout);
    if (node.name, "name" in node) {
      result.element.addModifier(["android:theme", `@style/${node.name}`])
    }

  return result.build(0)
};

const androidCheckBox = (node: SceneNode & BaseFrameMixin): string => {

  const result = new androidDefaultBuilder("CheckBox")
    .setId(node)
    .position(node,localSettings.optimizeLayout)
    .size(node,localSettings.optimizeLayout);
    result.element.addModifier(["android:checked", `false`])

  return result.build(0);
};

const androidLinear = (node: SceneNode & BaseFrameMixin, indentLevel: number): string => {
  const children = widgetGeneratorWithLimits(
    node,
    node.children.length > 1 ? indentLevel + 1 : indentLevel
  );

  const anyStack = createDirectionalStack(children, node.name, node);
  return androidContainer(node, anyStack);
}

const androidScroll = (node: SceneNode & BaseFrameMixin, indentLevel: number): string => {

  const children = widgetGeneratorWithLimits(
    node,
    node.children.length > 1 ? indentLevel + 1 : indentLevel
  );

  const anyStack = createDirectionalStack(children, node.name, node);
  return androidContainer(node, anyStack);
};

const androidEditText = (node: SceneNode & BaseFrameMixin): string => {
  let childText: SceneNode & TextNode | undefined = undefined
  if (node.children.filter(child => androidNameParser(child.name).type === AndroidType.text).length !== 0) {
    childText = node.children.filter((child): child is SceneNode & BaseFrameMixin => 
      androidNameParser(child.name).type === AndroidType.text
    )[0].children.filter((child): child is SceneNode & BaseFrameMixin =>
      androidNameParser(child.name).type === AndroidType.frameLayout
    )[0].children.filter((child): child is SceneNode & TextNode => child.type === "TEXT")[0]
  }
  const result = new androidDefaultBuilder("EditText")
  .setText(childText, true)
  .setId(node)
  .position(node,localSettings.optimizeLayout)
  .size(node,localSettings.optimizeLayout);
  return result.build(0);
}

const androidFrame = (
  node: SceneNode & BaseFrameMixin,
  indentLevel: number
): string => {
  const children = widgetGeneratorWithLimits(
    node,
    node.children.length > 1 ? indentLevel + 1 : indentLevel
  );

  const anyStack = createDirectionalStack(children, node.name, node);
  return androidContainer(node, anyStack);
};

const androidComponent = (node: SceneNode & BaseFrameMixin & TextNode, indentLevel: number): string => {
  
  switch (androidNameParser(node.name).type) {
    case AndroidType.view:
      return androidView(node)
    case AndroidType.text:
      if (
        "children" in node &&
        node.children[0].type === "FRAME" &&
        "children" in node.children[0] &&
        node.children[0].children[0].type === "TEXT"
      ) {
        return androidText(node.children[0].children[0], node)
      }
    case AndroidType.button:
      return androidButton(node)
    case AndroidType.list:
      return androidList(node)
    case AndroidType.listItem:
      return androidListItem(node, indentLevel)
    case AndroidType.switch:
      return androidSwitch(node)
    case AndroidType.checkBox:
      return androidCheckBox(node)
    case AndroidType.verticalScrollView:
    case AndroidType.horizontalScrollView:
      return androidScroll(node, indentLevel)
    case AndroidType.radioButton:
      return androidRadioButton(node)
    case AndroidType.editText:
      return androidEditText(node)
    case AndroidType.linearLayout:
      return androidLinear(node, indentLevel)
    default:
      return androidFrame(node, indentLevel)
  }
};

const getGravity = (
  layoutMode:string,
  isPrimary:boolean,
  align:string,
  gravity:string
):string => {
  if ((layoutMode=="HORIZONTAL" && isPrimary) || (layoutMode=="VERTICAL" && !isPrimary)) {
    if (align == "MIN") {
      return gravity=="" ? "start" : `${gravity}|start`;
    }
    else if (align == "MAX") {
      return gravity=="" ? "end" : `${gravity}|end`;
    }
    else if (align == "CENTER") {
      return gravity=="" ? "center_horizontal" : `${gravity}|center_horizontal`;
    }
  }
  else if ((layoutMode=="VERTICAL" && isPrimary) || (layoutMode=="HORIZONTAL" && !isPrimary)) {
    if (align == "MIN") {
      return gravity=="" ? "top" : `${gravity}|top`;
    }
    else if (align == "MAX") {
      return gravity=="" ? "bottom" : `${gravity}|bottom`;
    }
    else if (align == "CENTER") {
      return gravity=="" ? "center_vertical" : `${gravity}|center_vertical`;
    }
  }
  return gravity;
};

const getGravityParam = (
  inferredAutoLayout: InferredAutoLayoutResult
):string => {
  const primaty = getGravity(inferredAutoLayout.layoutMode, true, inferredAutoLayout.primaryAxisAlignItems, "");
  return getGravity(inferredAutoLayout.layoutMode, false, inferredAutoLayout.counterAxisAlignItems, primaty);
}

const createDirectionalStack = (
  children: string,
  idName: string,
  node: SceneNode & InferredAutoLayoutResult,
  isClickable: boolean = false
  ): string => {
    const {height, width, weight} = androidSize(node, localSettings.optimizeLayout);
    const {type, id}  = androidNameParser(idName)
    const parentType = androidNameParser(node.parent?.name).type
    const hasLinearLayoutParent = parentType === AndroidType.linearLayout

    let prop:Record<string, string | number> = {
      "android:layout_width": `${node.parent ? width : "match_parent"}`,
      "android:layout_height": `${node.parent ? height : "match_parent"}`
    }

    if (weight) {
      prop["android:layout_weight"] = `1` 
    }

    if (id !== "") {
      prop["android:id"] = `@+id/${id}` 
    }

    const grandchildrenHaveRadioButton = 
    "children" in node 
    && node.children.filter(node => 
      "children" in node
      && androidNameParser(node.name).type === AndroidType.linearLayout
      && node.children.filter(node => 
        androidNameParser(node.name).type === AndroidType.radioButton
      ).length !== 0
    ).length !== 0

    if (node.parent && (!hasLinearLayoutParent || ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE"))) {
      prop['android:layout_marginStart']=`${sliceNum(node.x)}dp`;
      prop['android:layout_marginTop']=`${sliceNum(node.y)}dp`;
    } if (!node.parent) {
      prop["xmlns:android"]="http://schemas.android.com/apk/res/android"
    }

    if (node.paddingTop > 0) {
      prop["android:paddingTop"] = `${node.paddingTop}dp`
    }
    if (node.paddingBottom > 0) {
      prop["android:paddingBottom"] = `${node.paddingBottom}dp`
    }
    if (node.paddingRight > 0) {
      prop["android:paddingRight"] = `${node.paddingRight}dp`
    }
    if (node.paddingLeft > 0) {
      prop["android:paddingLeft"] = `${node.paddingLeft}dp`
    }

    if (isClickable) {
      prop["android:clickable"] = "true"
    }

    if ("fills" in node || androidCornerRadius(node)) {
      const background = androidBackground(node)
      prop[background[0]] = background[1] ?? ""
    }

    if (node.layoutMode !== "NONE" && type !== AndroidType.button) {
      prop["android:orientation"] = node.layoutMode === "VERTICAL" ? "vertical":"horizontal"
      prop["android:gravity"] = `${getGravityParam(node)}`
      return generateAndroidViewCode(grandchildrenHaveRadioButton ? "RadioGroup" : "LinearLayout", prop, children)
    } 
    else if (type === AndroidType.verticalScrollView) {
      prop["android:scrollbars"]="vertical";
      return generateAndroidViewCode("ScrollView", prop, children)
    }
    else if (type === AndroidType.horizontalScrollView) {
      prop["android:scrollbars"]="horizontal";
      return generateAndroidViewCode("HorizontalScrollView", prop, children)
    }
    else {
      return generateAndroidViewCode("FrameLayout", prop, children);
    }
}

export const generateAndroidViewCode = (
  className: string,
  properties: Record<string, string | number>,
  children: string
): string => {

  const compactPropertiesArray = compactProp(properties)
  if (!className) {
    return `${indentString(
      children
    )}`;
  }
  else if (!children) {
    return `<${className}\n ${compactPropertiesArray}/>\n`;
  }
  else {
    return `<${className}\n ${compactPropertiesArray}>\n\n${indentString(
      children
    )}\n</${className}>\n`;
  }
};

// todo should the plugin manually Group items? Ideally, it would detect the similarities and allow a ForEach.
const widgetGeneratorWithLimits = (
  node: SceneNode & ChildrenMixin,
  indentLevel: number
) => {
  if (node.children.length < 10) {
    // standard way
    return androidWidgetGenerator(
      commonSortChildrenWhenInferredAutoLayout(
        node,
        localSettings.optimizeLayout
      ),
      indentLevel
    );
  }

  const chunk = 10;
  let strBuilder = "";
  const slicedChildren = commonSortChildrenWhenInferredAutoLayout(
    node,
    localSettings.optimizeLayout
  ).slice(0, 100);

  // split node.children in arrays of 10, so that it can be Grouped. I feel so guilty of allowing this.
  for (let i = 0, j = slicedChildren.length; i < j; i += chunk) {
    const chunkChildren = slicedChildren.slice(i, i + chunk);
    const strChildren = androidWidgetGenerator(chunkChildren, indentLevel);
    strBuilder += `${indentString(strChildren)}`;
  }

  return strBuilder;
};

export const androidCodeGenTextStyles = () => {
  const result = previousExecutionCache
    .map((style) => `${style}`)
    .join("\n// ---\n");
  if (!result) {
    return "// No text styles in this selection";
  }
  return result;
};
