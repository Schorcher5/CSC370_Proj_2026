package integration 
 
import (
	"fmt"
	"os/exec"
	"strings"
)
 
// Section prints a labeled divider so multi-step check output stays readable.
func Section(title string) {
	fmt.Printf("\n=== %s ===\n", title)
}
 
// RunPrint runs a command, streams its combined stdout+stderr to stdout, and returns an error (without killing the caller) if the command failed.
func RunPrint(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	fmt.Print(string(out))
	if err != nil {
		return fmt.Errorf("%s %s: %w", name, strings.Join(args, " "), err)
	}
	return nil
}

