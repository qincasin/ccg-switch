use crate::models::prompt::PromptPreset;
use std::fs;
use std::io;
use std::path::PathBuf;

fn get_prompts_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch").join("prompts"))
}

pub fn list_prompts() -> Result<Vec<PromptPreset>, io::Error> {
    let prompts_dir = get_prompts_dir()?;
    if !prompts_dir.exists() {
        fs::create_dir_all(&prompts_dir)?;
        return Ok(vec![]);
    }

    let mut prompts = Vec::new();
    for entry in fs::read_dir(&prompts_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "md") {
            let name = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&path)?;
            prompts.push(PromptPreset {
                name,
                content,
                file_path: path.to_string_lossy().to_string(),
            });
        }
    }
    prompts.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(prompts)
}

pub fn get_prompt(name: &str) -> Result<PromptPreset, io::Error> {
    let path = get_prompts_dir()?.join(format!("{}.md", name));
    if !path.exists() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "Prompt not found"));
    }
    let content = fs::read_to_string(&path)?;
    Ok(PromptPreset {
        name: name.to_string(),
        content,
        file_path: path.to_string_lossy().to_string(),
    })
}

pub fn save_prompt(name: &str, content: &str) -> Result<(), io::Error> {
    let prompts_dir = get_prompts_dir()?;
    fs::create_dir_all(&prompts_dir)?;
    let path = prompts_dir.join(format!("{}.md", name));
    fs::write(&path, content)?;
    Ok(())
}

pub fn delete_prompt(name: &str) -> Result<(), io::Error> {
    let path = get_prompts_dir()?.join(format!("{}.md", name));
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}
