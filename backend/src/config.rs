use serde::Deserialize;
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub listen_address: String,
    pub max_concurrent_vms: usize,
    pub clang_path: PathBuf,
    pub includes_path: PathBuf,
    pub rootfs_path: PathBuf,
    pub vmlinux_path: PathBuf,
}

impl Config {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let contents = fs::read_to_string(path)?;
        let mut config: Config = toml::from_str(&contents)?;
        if let Some(port) = std::env::var_os("BACKEND_PORT") {
            config.override_port(port.to_str().ok_or("BACKEND_PORT must be valid UTF-8")?)?;
        }
        Ok(config)
    }

    fn override_port(&mut self, port: &str) -> Result<(), Box<dyn std::error::Error>> {
        let port = port
            .parse::<u16>()
            .ok()
            .filter(|port| *port != 0)
            .ok_or("BACKEND_PORT must be an integer between 1 and 65535")?;
        let mut address: SocketAddr = self.listen_address.parse()?;
        address.set_port(port);
        self.listen_address = address.to_string();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    fn config() -> Config {
        toml::from_str(include_str!("../config.toml")).unwrap()
    }

    #[test]
    fn default_port_comes_from_config() {
        assert_eq!(config().listen_address, "0.0.0.0:8081");
    }

    #[test]
    fn port_override_preserves_bind_address() {
        for host in ["0.0.0.0", "127.0.0.1", "[::1]"] {
            let mut config = config();
            config.listen_address = format!("{host}:8081");
            config.override_port("19081").unwrap();
            assert_eq!(config.listen_address, format!("{host}:19081"));
        }
    }

    #[test]
    fn port_override_accepts_boundaries() {
        for port in ["1", "65535"] {
            let mut config = config();
            config.override_port(port).unwrap();
            assert_eq!(config.listen_address, format!("0.0.0.0:{port}"));
        }
    }

    #[test]
    fn port_override_rejects_invalid_values() {
        for port in ["", "0", "65536", "-1", "http", "8081;", " 8081"] {
            let mut config = config();
            let error = config.override_port(port).unwrap_err();
            assert!(error.to_string().contains("BACKEND_PORT"));
            assert_eq!(config.listen_address, "0.0.0.0:8081");
        }
    }
}
