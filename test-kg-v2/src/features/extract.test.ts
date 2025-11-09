import { describe, it, expect } from 'vitest';
import { chunking } from './extract';

describe('chunking', () => {
  it('should return empty array for empty text', () => {
    expect(chunking('')).toEqual([]);
    expect(chunking('   ')).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const text = 'This is a short text.';
    const result = chunking(text, 300, 50);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it('should split text into multiple chunks with proper overlap', () => {
    const text = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five. This is sentence six. This is sentence seven. This is sentence eight. This is sentence nine. This is sentence ten.';
    const result = chunking(text, 100, 30);

    expect(result.length).toBeGreaterThan(1);

    // Check that chunks have overlap
    for (let i = 0; i < result.length - 1; i++) {
      const currentChunk = result[i];
      const nextChunk = result[i + 1];

      // The end of current chunk should overlap with start of next chunk
      const currentEnd = currentChunk.slice(-30);
      expect(nextChunk).toContain(currentEnd.trim().split(' ').slice(-3).join(' '));
    }
  });

  it('should preserve sentence boundaries', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here.';
    const result = chunking(text, 60, 20);

    // Each chunk should end with sentence-ending punctuation or be the last chunk
    result.forEach((chunk, index) => {
      if (index < result.length - 1) {
        const trimmed = chunk.trim();
        const lastChar = trimmed[trimmed.length - 1];
        // Should end with sentence punctuation
        expect(['.', '!', '?']).toContain(lastChar);
      }
    });
  });

  it('should handle text without sentence boundaries', () => {
    const text = 'a'.repeat(500); // Long text with no punctuation
    const result = chunking(text, 100, 20);

    expect(result.length).toBeGreaterThan(1);
    // Should still split even without sentence boundaries
    result.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(100);
    });
  });

  it('should respect maxChunk parameter', () => {
    const text = 'Word '.repeat(200); // Create long text
    const maxChunk = 150;
    const result = chunking(text, maxChunk, 20);

    result.forEach(chunk => {
      // Chunks should not exceed maxChunk (accounting for sentence boundaries)
      expect(chunk.length).toBeLessThanOrEqual(maxChunk * 1.1); // 10% tolerance for sentence boundaries
    });
  });

  it('should handle custom overlap values', () => {
    const text = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven.';
    const overlap = 15;
    const result = chunking(text, 50, overlap);

    expect(result.length).toBeGreaterThan(1);

    // Verify overlap exists between consecutive chunks
    for (let i = 0; i < result.length - 1; i++) {
      const currentChunk = result[i];
      const nextChunk = result[i + 1];

      // There should be some overlapping content
      const currentWords = currentChunk.split(' ');
      const nextWords = nextChunk.split(' ');

      // At least one word from end of current should appear in next
      const hasOverlap = currentWords.slice(-5).some(word =>
        nextWords.slice(0, 5).includes(word)
      );
      expect(hasOverlap).toBe(true);
    }
  });

  it('should handle text with mixed punctuation', () => {
    const text = 'Question? Answer! Statement. Another question? Final statement.';
    const result = chunking(text, 30, 10);

    expect(result.length).toBeGreaterThan(0);
    result.forEach(chunk => {
      expect(chunk.length).toBeGreaterThan(0);
    });
  });

  it('should handle knowledge graph extraction scenario', () => {
    const article = `
      John Smith works at TechCorp as a software engineer. TechCorp is located in San Francisco.
      Jane Doe is the CEO of TechCorp. She founded the company in 2015.
      The company specializes in artificial intelligence and machine learning.
      John and Jane both graduated from Stanford University.
    `.trim();

    const result = chunking(article, 150, 50);

    expect(result.length).toBeGreaterThan(0);

    // Verify that entity mentions might appear in multiple chunks due to overlap
    // This helps LLM extract relationships across chunk boundaries
    const johnMentions = result.filter(chunk => chunk.includes('John'));
    const techCorpMentions = result.filter(chunk => chunk.includes('TechCorp'));

    expect(johnMentions.length).toBeGreaterThan(0);
    expect(techCorpMentions.length).toBeGreaterThan(0);
  });

  it('should handle single sentence longer than maxChunk', () => {
    const longSentence = 'This is a very long sentence that exceeds the maximum chunk size and has no punctuation in between to break it up naturally so it should be split anyway';
    const result = chunking(longSentence, 50, 10);

    // Should still split even if no sentence boundary exists
    expect(result.length).toBeGreaterThan(1);
  });
});
