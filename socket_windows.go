//go:build windows

package main

import (
	"syscall"
)

// setSocketOptions configures SO_REUSEADDR and SO_BROADCAST on Windows (SO_REUSEPORT is not supported).
func setSocketOptions(fd uintptr) {
	_ = syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1)
	_ = syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
}
