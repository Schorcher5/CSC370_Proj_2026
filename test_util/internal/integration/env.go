
package integration 
 
import (
	"bufio"
	"os"
	"strings"
)
 
// LoadEnv does a minimal parse of a .env file (KEY=VALUE per line, # comments ignored). 
// It does not shell-expand or handle quoting beyond trimming whitespace, since docker compose's own .env format is that simple too.
// Returns an empty map if the file doesn't exist.
func LoadEnv(path string) map[string]string {
	env := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return env
	}
	defer f.Close()
 
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			env[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return env
}
 
// GetOr returns m[key] if present and non-empty, otherwise def.
func GetOr(m map[string]string, key, def string) string {
	if v, ok := m[key]; ok && v != "" {
		return v
	}
	return def
}

