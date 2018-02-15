import expect from "expect";
import Plugin from "..";

describe("StartServerPlugin", function() {
  it("should be `import`-able", function() {
    expect(Plugin).toBeA(Function);
  });

  it("should be `require`-able", function() {
    expect(require("..")).toBe(Plugin);
  });

  it("should accept a string name", function() {
    const p = new Plugin('test');
    expect(p.options.name).toBe('test');
  });

  it("should accept an options object", function() {
    const p = new Plugin({whee: true});
    expect(p.options.whee).toBe(true);
  });

  it("should calculate arguments", function() {
    const p = new Plugin({nodeArgs: ['meep'], args: ['moop']});
    const args = p._getArgs();
    expect(args.filter(a => a === 'meep').length).toBe(1);
    expect(args.slice(-2)).toEqual(['--', 'moop']);
  });

  it("should parse the inspect port", function() {
    const p = new Plugin({nodeArgs: ['--inspect=9230']});
    const port = p._getInspectPort(p._getArgs())
    expect(port).toBe(9230)
  })

  it("should remove host when parsing inspect port", function() {
    const p = new Plugin({nodeArgs: ['--inspect=localhost:9230']});
    const port = p._getInspectPort(p._getArgs())
    expect(port).toBe(9230)
  })

  it("should return undefined inspect port is not set", function() {
    const p = new Plugin({nodeArgs: ['--inspect']});
    const port = p._getInspectPort(p._getArgs())
    expect(port).toBe(undefined)
  })

  it("should return default signal if signal is not passed", function() {
    const p = new Plugin();
    const signal = p._getSignal();
    expect(signal).toBe('SIGUSR2');
  })

  it("should allow user to override the default signal", function() {
    const p = new Plugin({ signal: 'SIGUSR1' });
    const signal = p._getSignal();
    expect(signal).toBe('SIGUSR1');
  })

  it("should allow user to override the default signal", function() {
    const p = new Plugin({ signal: 2 });
    const signal = p._getSignal();
    expect(signal).toBe(2);
  })

  it("should allow user to disable sending a signal", function() {
    const p = new Plugin({ signal: false });
    const signal = p._getSignal();
    expect(signal).toBe(undefined);
  })
});
