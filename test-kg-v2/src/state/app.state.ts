import type Sigma from 'sigma';
import type { KnowledgeGraph } from '../share/type';

/**
 * Global application state
 */
class AppState {
  private _sigmaInstance: Sigma | null = null;
  private _currentGraph: KnowledgeGraph | null = null;

  get sigmaInstance(): Sigma | null {
    return this._sigmaInstance;
  }

  set sigmaInstance(instance: Sigma | null) {
    this._sigmaInstance = instance;
  }

  get currentGraph(): KnowledgeGraph | null {
    return this._currentGraph;
  }

  set currentGraph(graph: KnowledgeGraph | null) {
    this._currentGraph = graph;
  }

  /**
   * Clear the current Sigma instance
   */
  clearSigma(): void {
    if (this._sigmaInstance) {
      this._sigmaInstance.kill();
      this._sigmaInstance = null;
    }
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.clearSigma();
    this._currentGraph = null;
  }
}

// Export singleton instance
export const appState = new AppState();
