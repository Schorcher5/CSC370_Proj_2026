package main
 
import (
	"log"
	"test_util/internal/integration"
)
 
func main() {
	if err := checks.RunDBCheck(); err != nil {
		log.Fatal(err)
	}
}

