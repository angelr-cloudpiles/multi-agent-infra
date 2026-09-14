import fs from 'node:fs';

const catalog=JSON.parse(fs.readFileSync(new URL('../model-catalog.json',import.meta.url)));
const profiles=JSON.parse(fs.readFileSync(new URL('../agent-profiles.json',import.meta.url)));
const aliases=Object.fromEntries(Object.entries(catalog.model_groups).map(([name,model])=>[name,model.model_id]));
const agents=Object.fromEntries(Object.entries(profiles.agents).map(([agentId,profile])=>{
  if(!aliases[profile.default_model]||!profile.permitted_models?.every(model=>aliases[model]))throw new Error(`Invalid model reference for ${agentId}`);
  return [agentId,{alias:profile.default_model,escalations:profile.permitted_models.filter(model=>model!==profile.default_model),maxIterations:profile.maxIterations,maxTokens:profile.maxTokens,timeoutSeconds:profile.timeoutSeconds}];
}));

export const policy={aliases,agents,contentAlias:profiles.content_default_model,productionApprovalRequired:profiles.productionApprovalRequired,maxConcurrentRuns:profiles.maxConcurrentRuns};
export {catalog,profiles};
