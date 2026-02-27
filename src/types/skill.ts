export type SkillApps = Record<string, boolean>;

export interface Skill {
    id: string;
    name: string;
    description: string;
    version?: string;
    contentPath: string;
    source: 'user' | 'project' | 'plugin';
    enabled: boolean;
    apps?: SkillApps;
}
