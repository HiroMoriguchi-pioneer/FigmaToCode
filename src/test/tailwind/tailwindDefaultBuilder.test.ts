import { AltRectangleNode, AltFrameNode } from "./../../altNodes/altMixins";
import { TailwindDefaultBuilder } from "./../../tailwind/tailwindDefaultBuilder";
import { tailwindMain } from "../../tailwind/tailwindMain";

describe("Tailwind Default Builder", () => {
  // @ts-ignore for some reason, need to override this for figma.mixed to work
  global.figma = {
    mixed: undefined,
  };

  it("JSX", () => {
    const node = new AltRectangleNode();
    node.name = "RECT";

    const builder = new TailwindDefaultBuilder(true, node, true);

    expect(builder.build()).toEqual(' className="RECT"');

    builder.reset();
    expect(builder.attributes).toEqual("");
  });

  it("JSX being used", () => {
    const node = new AltFrameNode();
    node.width = 32;
    node.height = 32;
    node.x = 0;
    node.y = 0;
    node.name = "FRAME";
    node.layoutMode = "NONE";
    node.counterAxisSizingMode = "FIXED";

    const child = new AltRectangleNode();
    child.width = 4;
    child.height = 4;
    child.x = 9;
    child.y = 9;
    child.name = "RECT";
    child.fills = [
      {
        type: "SOLID",
        color: {
          r: 1,
          g: 1,
          b: 1,
        },
      },
    ];

    node.children = [child];
    child.parent = node;
    expect(tailwindMain("", [node], true, true))
      .toEqual(`<div className="FRAME w-8 h-8">
<div className="RECT absolute w-1 h-1 bg-white" style={{left:9px, top:9px}}></div></div>`);
  });
});