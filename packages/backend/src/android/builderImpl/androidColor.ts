import { retrieveTopFill } from "../../common/retrieveFill";
import { getCommonRadius } from "../../common/commonRadius";
import { sliceNum } from "../../common/numToAutoFixed";
import { resourceLowerCaseName } from "../androidDefaultBuilder";

export const colors: { [string : string]: string } = {
  text_normal : "e1e1e1",
  text_selectPoint : "a1a1a1",
  text_sub : "7c7c84",
  text_normal_black : "24242a",
  color_accent : "1ff8f8",
  background_sideMapList : "0e0e11",
  background_fullscreen : "0e0f11",
  background_routeInfo_destination : "28282c",
  background_textField : "343434",
  background_pop_up_gradientTop : "30353c",
  background_pop_up_gradientBottom : "121416",
  back_pop_up : "040405",
  divider_list : "3a434d",
  border_list : "3f4d5e",
  background_map_common_button : "e4e8f2",
  border_map_common_button : "ffffff",
  background_map_accent_button : "f2f4fa",
  background_guide_general_road : "e4e8f2",
  background_guide_toll_road : "22b7f2",
  background_lane_plate : "143783",
  background_guide_cross : "eef2fc",
  background_guide_cross_night : "143783",
  border_guide_cross : "808080",
  background_highway_routeMonitor : "c2c6ce",
  border_highway_routeMonitor : "f0f0f0",
  background_highway_facility_up : "0a5c33",
  background_border_highway_facility_middle : "0d2d1d",
  background_highway_facility_low : "eaedf3",
  background_highway_exit : "2156c0",
  background_highway_road : "d9d9d9",
  background_highway_roadside : "9f9f9f",
  background_route_general_light_green : "88f888",
  background_route_general_green : "10b010",
  background_route_toll_light_blue : "88c0f8",
  background_route_toll_blue : "1888d8",
  background_route_toll_dark_blue : "0062c0"
}

export const AndroidSolidColor = (fill: Paint): string => {
  if (fill && fill.type === "SOLID") {
    return androidColor(fill.color, fill.opacity ?? 1.0, false);
  }

  return "";
};

export const androidSolidColor = (
  fills: ReadonlyArray<Paint> | PluginAPI["mixed"]
): string => {
  const fill = retrieveTopFill(fills);

  if (fill && fill.type === "SOLID") {
    // opacity should only be null on set, not on get. But better be prevented.
    const opacity = fill.opacity ?? 1.0;
    return androidColor(fill.color, opacity);
  } else if (fill?.type === "IMAGE") {
    return androidColor(
      {
        r: 0.5,
        g: 0.23,
        b: 0.27,
      },
      0.5
    );
  }

  return "";
};

export const androidBackground = (node: SceneNode): [string, string] => {
  const prefix = "@drawable/"
  const background: [string, string] = ["android:background", prefix]

  background[1] += androidCornerRadius(node)
  background[1] += androidFills(node, background[1] === prefix)
  background[1] += androidStrokes(node, background[1] === prefix)

  return background[1] === prefix ? ["", ""] : background
}

export const androidStrokes = (node: SceneNode, isFirst: boolean): string => {
  if ("strokes" in node && node.strokes[0]) {
    const color = AndroidSolidColor(node.strokes[0])
    const lineWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1

    return `${isFirst ? "" : "_"}border_${color}_weight_${lineWeight}`
  }
  return ""
}

const androidFills = (node: SceneNode, isFirst: boolean): string => {
  if ("fills" in node) {
    const fill = retrieveTopFill(node.fills)
    if (fill) {
      switch(fill.type) {
        case "SOLID":
          const solid = androidColor(fill.color, fill.opacity ?? 1.0, false)
          return isFirst ? "" : "_" + solid
        case "GRADIENT_ANGULAR":
        case "GRADIENT_DIAMOND":
        case "GRADIENT_LINEAR":
        case "GRADIENT_RADIAL":
          let gradient = isFirst ? `${resourceLowerCaseName(fill.type)}` : `_${resourceLowerCaseName(fill.type)}`
          let gradientColors: string[] = []
          fill.gradientStops.forEach((node) => {
            const color = androidColor(node.color, node.color.a, false)
            gradientColors.push(color)
            gradient += `_${color}`
          });
          return gradient
      }
    }
  } 
  return ""
}

export const androidCornerRadius = (node: SceneNode): string => {
  const radius = getCommonRadius(node);
  if ("all" in radius) {
    if (radius.all > 0) {
      return `radius_${sliceNum(radius.all)}`
    }
  }
  return ""
};

export const androidColor = (color: RGB | RGBA, opacity: number, prefix: boolean = true): string => {
  const hex = `${color2hex(color.r)}${color2hex(color.g)}${color2hex(color.b)}`;
  return convertResourceColor(hex, prefix)
};

const convertResourceColor = (hex: string, prefix: boolean): string => {
  const reversed = Object.entries(colors).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as { [key: string]: string });

  if (prefix) {
    return reversed[hex] ? `@color/${reversed[hex]}` : "#" + hex 
  } else {
    return reversed[hex] ? `${reversed[hex]}` : hex
  }
}

export const color2hex = (color: number): string => {
  const i = Math.min(255,Math.round(color * 255));
  const t = `0${i.toString(16)}`;
  return t.slice(t.length-2);
};