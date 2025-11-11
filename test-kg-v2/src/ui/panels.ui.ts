import type { KnowledgeGraph } from '../share/type';

/**
 * Show JSON output in the side panel
 */
export const showJsonOutput = (knowledgeGraph: KnowledgeGraph): void => {
  const jsonPanel = document.getElementById('json-panel');
  if (!jsonPanel) return;

  const html = `
    <h3>JSON Output</h3>
    <pre>${JSON.stringify(knowledgeGraph, null, 2)}</pre>
  `;

  jsonPanel.innerHTML = html;
  jsonPanel.classList.add('show');
};

/**
 * Show node details in the side panel
 */
export const showNodeDetails = (nodeKey: string, knowledgeGraph: KnowledgeGraph): void => {
  const detailsPanel = document.getElementById('details-panel');
  if (!detailsPanel) return;

  // Find all triplets related to this node
  const relatedTriplets = knowledgeGraph.triplets.filter(
    (t) =>
      `${t.subject.name}_${t.subject.entity_type}` === nodeKey ||
      `${t.object.name}_${t.object.entity_type}` === nodeKey
  );

  if (relatedTriplets.length === 0) return;

  // Get node details from first triplet
  const firstTriplet = relatedTriplets[0];
  const node =
    `${firstTriplet.subject.name}_${firstTriplet.subject.entity_type}` === nodeKey
      ? firstTriplet.subject
      : firstTriplet.object;

  let html = `<h3>${node.name}</h3>`;
  html += `<p><strong>Type:</strong> ${node.entity_type}</p>`;

  // Show attributes if any
  if (node.attributes && node.attributes.length > 0) {
    html += `<p><strong>Attributes:</strong></p>`;
    node.attributes.forEach((attr) => {
      html += `<p style="margin-left: 12px;">• ${attr.key}: ${attr.value}</p>`;
    });
  }

  // Show related triplets
  html += `<p style="margin-top: 16px;"><strong>Relationships (${relatedTriplets.length}):</strong></p>`;
  relatedTriplets.forEach((triplet) => {
    html += `<p style="margin-left: 12px; font-size: 13px;">`;
    html += `${triplet.subject.name} → <em>${triplet.predicate.name}</em> → ${triplet.object.name}`;
    html += `</p>`;
  });

  detailsPanel.innerHTML = html;
  detailsPanel.classList.add('show');
};

/**
 * Hide the details panel
 */
export const hideDetailsPanel = (): void => {
  const detailsPanel = document.getElementById('details-panel');
  if (detailsPanel) {
    detailsPanel.classList.remove('show');
  }
};
