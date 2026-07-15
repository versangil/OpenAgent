/**
 * Enhanced Agent Orchestrator for Agentic IDE
 * 
 * Extends the basic planner with multi-agent support, agent collaboration,
 * and advanced reasoning capabilities.
 */
import { planMicrotask } from './planner.js';
import { searchIndex } from './indexer.js';

/**
 * Agent types with specialized capabilities
 */
const AGENT_TYPES = {
  CODE: 'code',
  DOCS: 'docs', 
  TESTS: 'tests',
  SECURITY: 'security',
  REFACTOR: 'refactor',
  GENERAL: 'general'
};

/**
 * Agent configuration and capabilities
 */
const AGENT_CAPABILITIES = {
  [AGENT_TYPES.CODE]: {
    description: 'Code understanding and generation',
    allowed_actions: ['read', 'write', 'analyze_code'],
    priority_files: ['.js', '.ts', '.py', '.java', '.go']
  },
  [AGENT_TYPES.DOCS]: {
    description: 'Documentation generation and management',
    allowed_actions: ['read', 'write', 'generate_docs'],
    priority_files: ['.md', '.txt', 'README', 'docs/']
  },
  [AGENT_TYPES.TESTS]: {
    description: 'Test generation and execution',
    allowed_actions: ['read', 'write', 'run_tests', 'generate_tests'],
    priority_files: ['test/', 'spec/', '*test*', '*spec*']
  },
  [AGENT_TYPES.SECURITY]: {
    description: 'Security scanning and vulnerability detection',
    allowed_actions: ['read', 'scan_security', 'analyze_deps'],
    priority_files: ['package.json', 'requirements.txt', 'Dockerfile']
  },
  [AGENT_TYPES.REFACTOR]: {
    description: 'Code refactoring and optimization',
    allowed_actions: ['read', 'write', 'refactor_code', 'optimize_performance'],
    priority_files: ['.js', '.ts', '.py']
  },
  [AGENT_TYPES.GENERAL]: {
    description: 'General purpose problem solving',
    allowed_actions: ['read', 'write', 'run_tests', 'research'],
    priority_files: ['*']
  }
};

/**
 * Enhanced microtask planning with multi-agent support
 */
export async function orchestrateMicrotask(manifest, snapshot, adapter) {
  // First, use existing planner to get initial plan
  const { plan, prMetadata } = await planMicrotask(manifest, snapshot, adapter);
  
  // Enhance plan with multi-agent capabilities if needed
  const enhancedPlan = await enhancePlanWithAgents(plan, manifest, snapshot, adapter);
  
  return { plan: enhancedPlan, prMetadata };
}

/**
 * Enhance basic plan with specialized agents based on task complexity
 */
async function enhancePlanWithAgents(basePlan, manifest, snapshot, adapter) {
  const goal = manifest.goal.toLowerCase();
  const title = manifest.title.toLowerCase();
  
  // Determine if we need specialized agents
  let primaryAgentType = AGENT_TYPES.GENERAL;
  
  if (goal.includes('code') || goal.includes('implement') || goal.includes('function')) {
    primaryAgentType = AGENT_TYPES.CODE;
  } else if (goal.includes('document') || goal.includes('readme') || goal.includes('docs')) {
    primaryAgentType = AGENT_TYPES.DOCS;
  } else if (goal.includes('test') || goal.includes('spec')) {
    primaryAgentType = AGENT_TYPES.TESTS;
  } else if (goal.includes('security') || goal.includes('vulnerability') || goal.includes('scan')) {
    primaryAgentType = AGENT_TYPES.SECURITY;
  } else if (goal.includes('refactor') || goal.includes('optimize') || goal.includes('performance')) {
    primaryAgentType = AGENT_TYPES.REFACTOR;
  }
  
  // Add agent type to plan metadata
  const enhancedPlan = {
    ...basePlan,
    agent_type: primaryAgentType,
    agent_capabilities: AGENT_CAPABILITIES[primaryAgentType],
    collaboration_enabled: manifest.allowed_actions.includes('delegate'),
    workspace_context: await buildWorkspaceContext(snapshot, manifest)
  };
  
  return enhancedPlan;
}

/**
 * Build comprehensive workspace context for agents
 */
async function buildWorkspaceContext(snapshot, manifest) {
  const context = {
    file_structure: snapshot.file_structure,
    language_distribution: snapshot.language_distribution,
    dependency_files: findDependencyFiles(snapshot),
    test_files: findTestFiles(snapshot),
    doc_files: findDocFiles(snapshot),
    entry_points: findEntryPoints(snapshot),
    recent_changes: [] // Would be populated from git in real implementation
  };
  
  return context;
}

/**
 * Find dependency-related files in workspace
 */
function findDependencyFiles(snapshot) {
  const depPatterns = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
                      'requirements.txt', 'Pipfile', 'poetry.lock', 'go.mod', 'Cargo.toml'];
  return snapshot.files.filter(file => 
    depPatterns.some(pattern => file.path.includes(pattern))
  );
}

/**
 * Find test-related files in workspace  
 */
function findTestFiles(snapshot) {
  const testPatterns = ['test', 'spec', '__tests__', 'testing'];
  return snapshot.files.filter(file => 
    testPatterns.some(pattern => file.path.toLowerCase().includes(pattern))
  );
}

/**
 * Find documentation files in workspace
 */
function findDocFiles(snapshot) {
  const docPatterns = ['.md', 'README', 'docs/', 'doc/', 'documentation'];
  return snapshot.files.filter(file => 
    docPatterns.some(pattern => file.path.toLowerCase().includes(pattern))
  );
}

/**
 * Find entry point files in workspace
 */
function findEntryPoints(snapshot) {
  const entryPatterns = ['main.', 'index.', 'app.', 'server.', 'cli.'];
  return snapshot.files.filter(file => 
    entryPatterns.some(pattern => file.path.toLowerCase().includes(pattern))
  );
}

// Export agent types for external use
export { AGENT_TYPES, AGENT_CAPABILITIES };