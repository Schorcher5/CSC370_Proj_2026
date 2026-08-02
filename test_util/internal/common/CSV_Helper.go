// Package shared provides the small set of helpers every per-table
// generator needs: reading/writing the CSVs that serve as the interchange
// format between tables, and a couple of randomization helpers for
// splitting population totals across categories.
package common 

import (
	"encoding/csv"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
)

// WriteCSV writes header+rows to <outDir>/<table>.csv, creating outDir if
// needed. Re-running a generator overwrites that table's file from scratch --
// generators do not append to or merge with existing data.
func WriteCSV(outDir, table string, header []string, rows [][]string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("creating output dir %s: %w", outDir, err)
	}
	path := filepath.Join(outDir, table+".csv")
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("creating %s: %w", path, err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.Write(header); err != nil {
		return err
	}
	for _, row := range rows {
		if err := w.Write(row); err != nil {
			return err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return err
	}
	fmt.Printf("  wrote %d rows -> %s\n", len(rows), path)
	return nil
}

// ReadCSV reads <outDir>/<table>.csv and returns its header and data rows.
func ReadCSV(outDir, table string) (header []string, rows [][]string, err error) {
	path := filepath.Join(outDir, table+".csv")
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("%s not found -- generate it first (go run ./cmd/gen_%s --out=%s): %w", path, table, outDir, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("parsing %s: %w", path, err)
	}
	if len(records) == 0 {
		return nil, nil, fmt.Errorf("%s has no rows", path)
	}
	return records[0], records[1:], nil
}

// Column extracts a single named column's values from rows returned by ReadCSV.
func Column(header []string, rows [][]string, name string) ([]string, error) {
	idx := -1
	for i, h := range header {
		if h == name {
			idx = i
			break
		}
	}
	if idx == -1 {
		return nil, fmt.Errorf("column %q not found (have: %v)", name, header)
	}
	out := make([]string, len(rows))
	for i, row := range rows {
		out[i] = row[idx]
	}
	return out, nil
}

// ColumnInts is Column, parsed to int and skipping empty (NULL) cells.
func ColumnInts(header []string, rows [][]string, name string) ([]int, error) {
	strs, err := Column(header, rows, name)
	if err != nil {
		return nil, err
	}
	out := make([]int, 0, len(strs))
	for _, s := range strs {
		if s == "" {
			continue
		}
		v, err := Atoi(s)
		if err != nil {
			return nil, fmt.Errorf("column value %q is not an int: %w", s, err)
		}
		out = append(out, v)
	}
	return out, nil
}

// SplitCounts randomly divides `total` into `n` non-negative integer parts
// that sum exactly to total. `alpha` (len n) biases the average size of each
// part -- higher alpha[i] means bucket i tends to get a larger share. Pass
// nil for an even-ish split. This is a quick weighted split for generating
// plausible-looking mock distributions, not a statistically rigorous draw.
func SplitCounts(rng *rand.Rand, total, n int, alpha []float64) []int {
	if n <= 0 {
		return nil
	}
	if alpha == nil {
		alpha = make([]float64, n)
		for i := range alpha {
			alpha[i] = 1.0
		}
	}
	weights := make([]float64, n)
	sum := 0.0
	for i := range weights {
		w := alpha[i] * (0.5 + rng.Float64())
		weights[i] = w
		sum += w
	}
	counts := make([]int, n)
	assigned := 0
	for i := 0; i < n-1; i++ {
		c := int(float64(total) * weights[i] / sum)
		if c < 0 {
			c = 0
		}
		counts[i] = c
		assigned += c
	}
	last := total - assigned
	if last < 0 {
		last = 0
	}
	counts[n-1] = last
	return counts
}
