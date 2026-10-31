import { describe, expect, it } from '@jest/globals';
import { withInlineDiagramImages } from './diagram-markdown';

describe('withInlineDiagramImages', () => {
  it('turns the diagram link into an inline image plus a full-size link', () => {
    const url = 'https://r2.example/generated/u/1.png?sig=a(b)c';
    const out = withInlineDiagramImages(`Intro\n\n[Generated Diagram Image](${url})`);
    expect(out).toContain(`![Generated Diagram Image](${url})`);
    expect(out).toContain(`[Open full size](${url})`);
  });

  it('leaves existing images and other links untouched', () => {
    const md = '![Generated Diagram Image](https://x/y.png) and [site](https://x)';
    expect(withInlineDiagramImages(md)).toBe(md);
  });

  it('handles multiple links', () => {
    const md = '[Generated Diagram Image](https://a/1.png)\n[Generated Diagram Image](https://a/2.png)';
    expect(withInlineDiagramImages(md).match(/!\[Generated Diagram Image\]/g)).toHaveLength(2);
  });
});
