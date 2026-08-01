#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, IntoVal, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProjectStatus {
    Funded = 0,
    InProgress = 1,
    Completed = 2,
    Flagged = 3,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MilestoneStatus {
    PendingSubmission = 0,
    PendingVerification = 1,
    Verified = 2,
    Rejected = 3,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Milestone {
    pub id: u32,
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub evidence_ipfs_cid: String,
    pub approvals: Vec<Address>,
    pub rejections: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Project {
    pub id: u32,
    pub name: String,
    pub funder: Address,
    pub contractor: Address,
    pub verifiers: Vec<Address>,
    pub milestones: Vec<Milestone>,
    pub status: ProjectStatus,
    pub flag_count: u32,
    pub token: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Treasury,
    ProjectCount,
    Project(u32),
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    pub fn init(env: Env, treasury: Address) {
        if env.storage().instance().has(&DataKey::Treasury) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::ProjectCount, &0u32);
    }

    pub fn get_treasury(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .expect("not initialized")
    }

    pub fn get_project_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ProjectCount)
            .unwrap_or(0)
    }

    pub fn create_project(
        env: Env,
        funder: Address,
        name: String,
        contractor: Address,
        verifiers: Vec<Address>,
        milestone_descriptions: Vec<String>,
        milestones_amounts: Vec<i128>,
        token: Address,
    ) -> u32 {
        funder.require_auth();

        if verifiers.len() != 3 {
            panic!("verifiers must be exactly 3");
        }

        if milestone_descriptions.len() != milestones_amounts.len() || milestone_descriptions.len() == 0 {
            panic!("invalid milestone parameters");
        }

        let mut total_budget: i128 = 0;
        let mut milestones: Vec<Milestone> = Vec::new(&env);

        for i in 0..milestone_descriptions.len() {
            let amount = milestones_amounts.get(i).unwrap();
            if amount <= 0 {
                panic!("milestone amount must be positive");
            }
            total_budget += amount;

            let milestone = Milestone {
                id: i as u32,
                description: milestone_descriptions.get(i).unwrap(),
                amount,
                status: MilestoneStatus::PendingSubmission,
                evidence_ipfs_cid: String::from_str(&env, ""),
                approvals: Vec::new(&env),
                rejections: Vec::new(&env),
            };
            milestones.push_back(milestone);
        }

        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .expect("not initialized");

        // Transfer funds from funder to Treasury atomically
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&funder, &treasury, &total_budget);

        let project_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProjectCount)
            .unwrap_or(0);

        let project_id = project_count + 1;
        let project = Project {
            id: project_id,
            name,
            funder: funder.clone(),
            contractor,
            verifiers,
            milestones,
            status: ProjectStatus::Funded,
            flag_count: 0,
            token,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);
        env.storage()
            .instance()
            .set(&DataKey::ProjectCount, &project_id);

        env.events().publish(
            (symbol_short!("created"), project_id),
            (funder, total_budget),
        );

        project_id
    }

    pub fn submit_proof(
        env: Env,
        caller: Address,
        project_id: u32,
        milestone_id: u32,
        evidence_ipfs_cid: String,
    ) {
        caller.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .expect("project not found");

        if caller != project.contractor {
            panic!("unauthorized contractor");
        }

        if evidence_ipfs_cid.len() == 0 {
            panic!("empty cid");
        }

        let mut milestone_found = false;
        let mut new_milestones: Vec<Milestone> = Vec::new(&env);

        for m in project.milestones.iter() {
            let mut updated_m = m.clone();
            if m.id == milestone_id {
                milestone_found = true;
                if m.status == MilestoneStatus::Verified {
                    panic!("milestone already verified");
                }
                updated_m.evidence_ipfs_cid = evidence_ipfs_cid.clone();
                updated_m.status = MilestoneStatus::PendingVerification;
            }
            new_milestones.push_back(updated_m);
        }

        if !milestone_found {
            panic!("milestone not found");
        }

        project.milestones = new_milestones;
        if project.status == ProjectStatus::Funded {
            project.status = ProjectStatus::InProgress;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        env.events().publish(
            (symbol_short!("proof_sub"), project_id),
            (milestone_id, evidence_ipfs_cid),
        );
    }

    pub fn verify_milestone(
        env: Env,
        caller: Address,
        project_id: u32,
        milestone_id: u32,
        approve: bool,
    ) {
        caller.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .expect("project not found");

        let mut is_verifier = false;
        for v in project.verifiers.iter() {
            if v == caller {
                is_verifier = true;
                break;
            }
        }
        if !is_verifier {
            panic!("unauthorized verifier");
        }

        let mut milestone_found = false;
        let mut release_amount: i128 = 0;
        let mut should_release = false;
        let mut new_milestones: Vec<Milestone> = Vec::new(&env);

        for m in project.milestones.iter() {
            let mut updated_m = m.clone();
            if m.id == milestone_id {
                milestone_found = true;
                if m.status != MilestoneStatus::PendingVerification {
                    panic!("milestone not pending verification");
                }

                for app in m.approvals.iter() {
                    if app == caller {
                        panic!("already voted");
                    }
                }
                for rej in m.rejections.iter() {
                    if rej == caller {
                        panic!("already voted");
                    }
                }

                if approve {
                    updated_m.approvals.push_back(caller.clone());
                    if updated_m.approvals.len() >= 2 {
                        updated_m.status = MilestoneStatus::Verified;
                        should_release = true;
                        release_amount = updated_m.amount;
                    }
                } else {
                    updated_m.rejections.push_back(caller.clone());
                    if updated_m.rejections.len() >= 2 {
                        updated_m.status = MilestoneStatus::Rejected;
                        if project.status != ProjectStatus::Completed {
                            project.status = ProjectStatus::Flagged;
                        }
                    }
                }
            }
            new_milestones.push_back(updated_m);
        }

        if !milestone_found {
            panic!("milestone not found");
        }

        project.milestones = new_milestones;

        // Check if all milestones are completed
        let mut all_verified = true;
        for m in project.milestones.iter() {
            if m.status != MilestoneStatus::Verified {
                all_verified = false;
                break;
            }
        }
        if all_verified {
            project.status = ProjectStatus::Completed;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        if should_release {
            let treasury_address: Address = env
                .storage()
                .instance()
                .get(&DataKey::Treasury)
                .expect("not initialized");

            let mut args = Vec::new(&env);
            args.push_back(project.contractor.to_val());
            args.push_back(release_amount.into_val(&env));

            env.invoke_contract::<()>(
                &treasury_address,
                &Symbol::new(&env, "release"),
                args,
            );

            env.events().publish(
                (symbol_short!("released"), project_id),
                (milestone_id, release_amount, project.contractor.clone()),
            );
        }

        env.events().publish(
            (symbol_short!("verified"), project_id),
            (milestone_id, caller, approve),
        );
    }

    pub fn flag_project(env: Env, caller: Address, project_id: u32) {
        caller.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .expect("project not found");

        project.flag_count += 1;
        if project.status != ProjectStatus::Completed {
            project.status = ProjectStatus::Flagged;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        env.events().publish(
            (symbol_short!("flagged"), project_id),
            (caller, project.flag_count),
        );
    }

    pub fn get_project(env: Env, project_id: u32) -> Project {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .expect("project not found")
    }
}

#[cfg(test)]
mod test;
