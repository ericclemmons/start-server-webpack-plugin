import expect from 'expect';
import Plugin from '..';

describe('StartServerPlugin', function() {
  it('should be `import`-able', function() {
    expect(Plugin).toBeInstanceOf(Function);
  });

  it('should be `require`-able', function() {
    expect(require('..')).toBe(Plugin);
  });

  it('should accept a string entryName', function() {
    const p = new Plugin('test');
    expect(p.options.entryName).toBe('test');
  });

  it('should accept an options object', function() {
    const p = new Plugin({whee: true});
    expect(p.options.whee).toBe(true);
  });

  it('should calculate arguments', function() {
    const p = new Plugin({nodeArgs: ['meep'], args: ['moop']});
    const args = p._getArgs();
    expect(args).toEqual(['meep']);
  });
});
