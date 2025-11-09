import { chunking } from './extract';

// Test 1: Simple article
console.log('=== Test 1: Simple Article ===');
const article1 = `
John Smith works at TechCorp as a software engineer. TechCorp is located in San Francisco.
Jane Doe is the CEO of TechCorp. She founded the company in 2015.
The company specializes in artificial intelligence and machine learning.
John and Jane both graduated from Stanford University.
`.trim();

const chunks1 = chunking(article1, 150, 50);
console.log(`Number of chunks: ${chunks1.length}\n`);
chunks1.forEach((chunk, index) => {
  console.log(`Chunk ${index + 1} (${chunk.length} chars):`);
  console.log(chunk);
  console.log('---\n');
});

// Test 2: Longer article with more content
console.log('\n=== Test 2: Longer Article ===');
const article2 = `
Artificial intelligence is transforming the technology industry. Machine learning algorithms can now process vast amounts of data.
Deep learning models have achieved remarkable results in image recognition. Neural networks are inspired by the human brain.
Companies like Google and Microsoft invest heavily in AI research. They develop tools that make AI accessible to developers.
The future of AI includes more sophisticated natural language processing. Chatbots and virtual assistants are becoming more capable.
Ethical considerations are important in AI development. Bias in training data can lead to unfair outcomes.
`.trim();

const chunks2 = chunking(article2, 200, 60);
console.log(`Number of chunks: ${chunks2.length}\n`);
chunks2.forEach((chunk, index) => {
  console.log(`Chunk ${index + 1} (${chunk.length} chars):`);
  console.log(chunk);
  console.log('---\n');
});

// Test 3: Show overlap
console.log('\n=== Test 3: Demonstrating Overlap ===');
const article3 = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here. Sixth sentence here.';
const chunks3 = chunking(article3, 60, 25);
console.log(`Number of chunks: ${chunks3.length}\n`);
chunks3.forEach((chunk, index) => {
  console.log(`Chunk ${index + 1} (${chunk.length} chars):`);
  console.log(chunk);
  if (index < chunks3.length - 1) {
    console.log(`\n⚡ Overlap with next chunk:`);
    const nextChunk = chunks3[index + 1];
    // Find common substring
    let overlapText = '';
    for (let i = chunk.length; i > 0; i--) {
      const ending = chunk.slice(-i);
      if (nextChunk.includes(ending)) {
        overlapText = ending;
        break;
      }
    }
    console.log(`"${overlapText}"`);
  }
  console.log('---\n');
});
