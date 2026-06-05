//go:build !windows

package main

import (
	"syscall"
)

// setSocketOptions configures SO_REUSEADDR, SO_REUSEPORT, and SO_BROADCAST on Unix-like systems.
func setSocketOptions(fd uintptr) {
	_ = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1)
	_ = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEPORT, 1)
	_ = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
}
