import type { ResearchSkillManifest, ResearchTaskType } from './contracts.js';
import { GENERATED_RESEARCH_SKILLS } from './generated/skills.js';

const catalog = deepFreeze([...GENERATED_RESEARCH_SKILLS]) as readonly ResearchSkillManifest[];

export function listResearchSkills(): readonly ResearchSkillManifest[] {
  return catalog;
}

export function getResearchSkill(taskType: ResearchTaskType): ResearchSkillManifest {
  const skill = catalog.find((item) => item.taskType === taskType);
  if (!skill) throw new TypeError(`No research skill supports ${taskType}`);
  return skill;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
