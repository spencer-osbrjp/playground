import { ENTITY_COLORS, DEFAULT_ENTITY_COLOR, DEFAULT_NODE_SIZE } from '../config/constants';

/**
 * Get color for a given entity type
 */
export const getColorForEntityType = (entityType: string): string => {
  return ENTITY_COLORS[entityType] || DEFAULT_ENTITY_COLOR;
};

/**
 * Get node size (can be enhanced with logic based on node importance)
 */
export const getNodeSize = (): number => {
  return DEFAULT_NODE_SIZE;
};

/**
 * Get edge color based on whether it's inferred
 */
export const getEdgeColor = (isInferred: boolean): string => {
  return isInferred ? '#ff9500' : '#999';
};

/**
 * Get edge size based on whether it's inferred
 */
export const getEdgeSize = (isInferred: boolean): number => {
  return isInferred ? 1.5 : 2;
};

/**
 * Get edge type based on whether it's inferred
 */
export const getEdgeType = (isInferred: boolean): 'line' | 'arrow' => {
  return isInferred ? 'line' : 'arrow';
};
