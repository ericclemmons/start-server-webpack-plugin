import expect from "expect";
import Plugin from "..";

describe("StartServerPlugin", function() {
  it("should be `import`-able", function() {
    expect(Plugin).toBeA(Function);
  });

  it("should be `require`-able", function() {
    expect(require("..")).toBe(Plugin);
  });
});
