use crate::models::skill::{Skill, SkillSource};
use std::fs;
use std::io;
use std::path::PathBuf;

fn get_user_skills_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude").join("commands"))
}

pub fn list_skills(project_dir: Option<&str>) -> Result<Vec<Skill>, io::Error> {
    let mut skills = Vec::new();

    // 扫描用户级技能
    let user_dir = get_user_skills_dir()?;
    if user_dir.exists() {
        scan_skills_dir(&user_dir, SkillSource::User, &mut skills)?;
    }

    // 扫描项目级技能
    if let Some(dir) = project_dir {
        let project_skills = PathBuf::from(dir).join(".claude").join("commands");
        if project_skills.exists() {
            scan_skills_dir(&project_skills, SkillSource::Project, &mut skills)?;
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

fn scan_skills_dir(dir: &PathBuf, source: SkillSource, skills: &mut Vec<Skill>) -> Result<(), io::Error> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "md") {
            let name = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&path)?;
            skills.push(Skill {
                name,
                content,
                file_path: path.to_string_lossy().to_string(),
                source: source.clone(),
            });
        }
    }
    Ok(())
}

pub fn get_skill(name: &str) -> Result<Skill, io::Error> {
    let path = get_user_skills_dir()?.join(format!("{}.md", name));
    if !path.exists() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "Skill not found"));
    }
    let content = fs::read_to_string(&path)?;
    Ok(Skill {
        name: name.to_string(),
        content,
        file_path: path.to_string_lossy().to_string(),
        source: SkillSource::User,
    })
}

pub fn save_skill(name: &str, content: &str) -> Result<(), io::Error> {
    let dir = get_user_skills_dir()?;
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(format!("{}.md", name)), content)?;
    Ok(())
}

pub fn delete_skill(name: &str) -> Result<(), io::Error> {
    let path = get_user_skills_dir()?.join(format!("{}.md", name));
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}
