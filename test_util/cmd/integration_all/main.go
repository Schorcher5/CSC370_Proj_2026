package main
 
import (
	"log"

  "test_util/internal/integration"
)
 
func main() {
	if err := integration.RunDBTest(); err != nil {
		log.Fatal(err)
	}
}
 

