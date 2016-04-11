import expect from "expect";
import Plugin from "..";

describe("StartServerPlugin", function() {
  it("should be `import`-able", function() {
    expect(Plugin).toBeA(Function);
  });
});
