package integration 
 
import (
	"errors"
	"fmt"
	"net"
	"os/exec"
	"strings"
	"time"
)
 
const dbContainerName = "census_mysql"
 
// RunDBTest verifies the MySQL container defined in docker-compose.yml is up, healthy, reachable, and serving the expected database. 
// It runs every check even if an earlier one fails, then returns a combined error describing everything that went wrong (nil if all checks passed).
func RunDBTest() error {
	env := LoadEnv(".env")
	rootPass := GetOr(env, "MYSQL_ROOT_PASSWORD", "devpassword")
	dbName := GetOr(env, "MYSQL_DATABASE", "census_demographics")
	dbPort := GetOr(env, "DB_PORT", "3306")
 
	var errs []error
 
	Section("Container status")
	if err := RunPrint("docker", "compose", "ps"); err != nil {
		errs = append(errs, err)
	}
 
	Section("Recent logs (db)")
	if err := RunPrint("docker", "compose", "logs", "--tail", "30", "db"); err != nil {
		errs = append(errs, err)
	}
 
	Section("Waiting for healthy status")
	if waitForHealthy(dbContainerName, 60*time.Second) {
		fmt.Println("Container is healthy.")
	} else {
		errs = append(errs, fmt.Errorf("container did not report healthy within 60s"))
	}
 
	Section("SHOW DATABASES")
	if err := RunPrint("docker", "compose", "exec", "-T", "db",
		"mysql", "-uroot", "-p"+rootPass, "-e", "SHOW DATABASES;"); err != nil {
		errs = append(errs, err)
	}
 
	Section(fmt.Sprintf("SHOW TABLES in %s", dbName))
	if err := RunPrint("docker", "compose", "exec", "-T", "db",
		"mysql", "-uroot", "-p"+rootPass, "-D", dbName, "-e", "SHOW TABLES;"); err != nil {
		errs = append(errs, err)
	}
 
	Section("External port check")
	addr := net.JoinHostPort("127.0.0.1", dbPort)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		fmt.Printf("Could not reach %s: %v\n", addr, err)
		errs = append(errs, err)
	} else {
		conn.Close()
		fmt.Printf("Port %s is reachable from host.\n", dbPort)
	}
 
	return errors.Join(errs...)
}
 
func waitForHealthy(container string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, err := exec.Command("docker", "inspect",
			"--format={{.State.Health.Status}}", container).Output()
		if err == nil && strings.TrimSpace(string(out)) == "healthy" {
			return true
		}
		time.Sleep(2 * time.Second)
	}
	return false
}

