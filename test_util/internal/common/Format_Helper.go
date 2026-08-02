package common

import {
  "strconv"
}

// Itoa is a tiny convenience wrapper so callers don't need to import strconv
// just to stringify an int for a CSV cell.
func Itoa(i int) string { return strconv.Itoa(i) }

func Atoi(s string) (int, error) { return strconv.Atoi(s) }

// Ftoa formats a float for a CSV cell with a fixed number of decimals.
func Ftoa(f float64, decimals int) string {
	return strconv.FormatFloat(f, 'f', decimals, 64)
}
