import { describe, it, expect } from 'vitest';
import { parse } from '../parser';
import { serialize } from '../serializer';

describe('Tab-ML Parser/Serializer Round-trip', () => {
  const testCases = [
    { input: '普通文本\t第二列\t第三列', desc: 'plain text row' },
    { input: '**粗体**\tnormal', desc: 'bold mark' },
    { input: '~~删除线~~\t!!警告!!', desc: 'strikethrough and warning' },
    { input: '++新增内容++\t[red]强调[/red]', desc: 'modified and semantic color' },
    { input: '[x] 已完成任务\tP0', desc: 'checked todo' },
    { input: '[ ] 待办事项\t[blue]API参数[/blue]', desc: 'unchecked todo with color' },
    { input: '[?] 待确认\tP2', desc: 'question todo' },
    { input: '# 一级标题', desc: 'heading 1' },
    { input: '## 二级标题', desc: 'heading 2' },
    { input: '### 三级标题', desc: 'heading 3' },
    { input: '\t缩进行\t内容', desc: 'indented row (1 level)' },
    { input: '\t\t二级缩进\t内容', desc: 'indented row (2 levels)' },
    { input: '![](images/photo.png =400x300)', desc: 'image with size' },
    { input: '[green]补充说明[/green]\t[gray]次要信息[/gray]', desc: 'multiple semantic colors' },
    { input: '**~~粗体删除线~~**\tnormal', desc: 'nested marks' },
  ];

  for (const tc of testCases) {
    it(`round-trip: ${tc.desc}`, () => {
      const doc = parse(tc.input);
      const output = serialize(doc);
      expect(output.trimEnd()).toBe(tc.input);
    });
  }

  it('round-trip: empty line separator', () => {
    const input = '第一行\n\n第二行';
    const doc = parse(input);
    const output = serialize(doc);
    expect(output).toBe(input);
  });

  it('round-trip: frontmatter', () => {
    const input = '---\ntitle: Test PRD\nauthor: 张三\n---\n# 标题\t内容';
    const doc = parse(input);
    expect(doc.frontmatter.title).toBe('Test PRD');
    expect(doc.frontmatter.author).toBe('张三');
    const output = serialize(doc);
    expect(output).toBe(input);
  });

  it('round-trip: multi-row document', () => {
    const input = [
      '---',
      'title: Test',
      '---',
      '# 标题',
      '## 子标题',
      '\t需求A\tP0\t进行中',
      '\t需求B\tP1\t未开始',
      '',
      '\t[x] 已完成',
      '\t[ ] 未完成',
    ].join('\n');
    const doc = parse(input);
    const output = serialize(doc);
    expect(output).toBe(input);
  });
});
