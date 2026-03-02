use crate::database::Database;
use std::sync::Arc;

pub struct AppState {
    pub db: Arc<Database>,
}

impl AppState {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}
