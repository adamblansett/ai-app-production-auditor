import type { Rule } from '../models/rule.js';
import { ProjectDetectionRule } from './project-detection.rule.js';
import { LocalhostUrlRule } from './localhost-url.rule.js';
import { EnvConsistencyRule } from './env-consistency.rule.js';
import { TestConfigurationRule } from './test-configuration.rule.js';
import { PackageScriptsRule } from './package-scripts.rule.js';
import { SecretDetectionRule } from './secret-detection.rule.js';
import { ProductionConfigRule } from './production-config.rule.js';
import { AiSafetyRule } from './ai-safety.rule.js';

export function createDefaultRules(): Rule[] {
  return [
    new ProjectDetectionRule(),
    new LocalhostUrlRule(),
    new EnvConsistencyRule(),
    new TestConfigurationRule(),
    new PackageScriptsRule(),
    new SecretDetectionRule(),
    new ProductionConfigRule(),
    new AiSafetyRule(),
  ];
}
