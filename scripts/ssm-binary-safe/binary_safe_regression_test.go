package datachannel

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"testing"

	"github.com/aws/session-manager-plugin/src/communicator"
	"github.com/aws/session-manager-plugin/src/config"
	"github.com/aws/session-manager-plugin/src/log"
	"github.com/aws/session-manager-plugin/src/message"
	"github.com/gorilla/websocket"
)

// Do not print payloads or auth-like upstream mock fixtures, even on failure.
type binarySafeSilentLog struct{}

func (binarySafeSilentLog) Tracef(string, ...interface{})          {}
func (binarySafeSilentLog) Debugf(string, ...interface{})          {}
func (binarySafeSilentLog) Infof(string, ...interface{})           {}
func (binarySafeSilentLog) Warnf(string, ...interface{}) error     { return nil }
func (binarySafeSilentLog) Errorf(string, ...interface{}) error    { return nil }
func (binarySafeSilentLog) Criticalf(string, ...interface{}) error { return nil }
func (binarySafeSilentLog) Trace(...interface{})                   {}
func (binarySafeSilentLog) Debug(...interface{})                   {}
func (binarySafeSilentLog) Info(...interface{})                    {}
func (binarySafeSilentLog) Warn(...interface{}) error              { return nil }
func (binarySafeSilentLog) Error(...interface{}) error             { return nil }
func (binarySafeSilentLog) Critical(...interface{}) error          { return nil }
func (binarySafeSilentLog) Flush()                                 {}
func (binarySafeSilentLog) Close()                                 {}
func (binarySafeSilentLog) WithContext(...string) log.T            { return binarySafeSilentLog{} }

// SendInputDataMessage performs the real serialization before this mock transport.
type binarySafeTransport struct {
	communicator.IWebSocketChannel
	payloads [][]byte
}

func (wire *binarySafeTransport) SendMessage(logger log.T, packet []byte, kind int) error {
	if kind != websocket.BinaryMessage {
		return errors.New("expected binary transport frame")
	}
	var decoded message.ClientMessage
	if decoded.DeserializeClientMessage(logger, packet) != nil {
		return errors.New("transport frame decode failed")
	}
	if decoded.PayloadType != uint32(message.Output) || decoded.SequenceNumber != int64(len(wire.payloads)) {
		return errors.New("transport frame metadata mismatch")
	}
	wire.payloads = append(wire.payloads, append([]byte(nil), decoded.Payload...))
	return nil
}

func binarySafeTestChannel(t *testing.T, sessionType string, handshake bool) (*DataChannel, *binarySafeTransport) {
	t.Helper()
	channel := new(DataChannel)
	channel.Initialize(binarySafeSilentLog{}, "", "", "", false)
	wire := new(binarySafeTransport)
	channel.wsChannel = wire
	if handshake {
		encoded, err := json.Marshal(message.SessionTypeRequest{SessionType: sessionType})
		if err != nil || channel.ProcessSessionTypeHandshakeAction(encoded) != nil {
			t.Fatal("session type setup failed")
		}
	} else {
		channel.SetSessionType(sessionType)
	}
	return channel, wire
}

func TestBinarySafeSessionPayload(t *testing.T) {
	cases := []struct {
		name, sessionType string
		handshake         bool
		input, want       []byte
	}{
		{"PortLF", config.PortPluginName, true, []byte{10}, []byte{10}},
		{"ShellLF", config.ShellPluginName, true, []byte{10}, []byte{13}},
		{"InteractiveCommandsLF", config.InteractiveCommandsPluginName, true, []byte{10}, []byte{13}},
		{"NonInteractiveCommandsLF", config.NonInteractiveCommandsPluginName, true, []byte{10}, []byte{13}},
		{"UnknownLF", "unsupported", false, []byte{10}, []byte{10}},
		{"UnsetLF", "", false, []byte{10}, []byte{10}},
		{"PortGeneralBinary", config.PortPluginName, true, []byte{0, 255, 13, 10, 1, 128}, []byte{0, 255, 13, 10, 1, 128}},
		{"ShellGeneralBinary", config.ShellPluginName, true, []byte{0, 255, 13, 10, 1, 128}, []byte{0, 255, 13, 10, 1, 128}},
	}
	for _, item := range cases {
		t.Run(item.name, func(t *testing.T) {
			channel, wire := binarySafeTestChannel(t, item.sessionType, item.handshake)
			before := append([]byte(nil), item.input...)
			if channel.SendInputDataMessage(binarySafeSilentLog{}, message.Output, item.input) != nil {
				t.Fatal("send failed")
			}
			if len(wire.payloads) != 1 || !bytes.Equal(wire.payloads[0], item.want) {
				t.Error("serialized payload violated session contract")
			}
			if !bytes.Equal(before, item.input) || channel.StreamDataSequenceNumber != 1 || channel.OutgoingMessageBuffer.Messages.Len() != 1 {
				t.Error("input ownership or sequence contract changed")
			}
		})
	}
}

func TestBinarySafeMuxBoundary(t *testing.T) {
	// Vendored smux frame.go: version(1), command(1), length(2), stream ID(4).
	// An invented 1017-byte complete request plus 8-byte frame is split 1024/1.
	request := append(bytes.Repeat([]byte{'x'}, 1013), '\r', '\n', '\r', '\n')
	frame := make([]byte, 8+len(request))
	frame[0], frame[1] = 1, 2
	binary.LittleEndian.PutUint16(frame[2:4], uint16(len(request)))
	binary.LittleEndian.PutUint32(frame[4:8], 1)
	copy(frame[8:], request)
	if config.StreamDataPayloadSize != 1024 || len(frame) != 1025 || !bytes.Equal(frame[1024:], []byte{10}) {
		t.Fatal("fixed framing boundary changed")
	}
	channel, wire := binarySafeTestChannel(t, config.PortPluginName, true)
	for offset := 0; offset < len(frame); offset += config.StreamDataPayloadSize {
		end := offset + config.StreamDataPayloadSize
		if end > len(frame) {
			end = len(frame)
		}
		if channel.SendInputDataMessage(binarySafeSilentLog{}, message.Output, frame[offset:end]) != nil {
			t.Fatal("boundary send failed")
		}
	}
	if len(wire.payloads) != 2 || len(wire.payloads[0]) != 1024 || len(wire.payloads[1]) != 1 {
		t.Fatal("boundary chunk shape changed")
	}
	received := bytes.Join(wire.payloads, nil)
	if !bytes.Equal(received, frame) || !bytes.HasSuffix(received[8:], []byte{'\r', '\n', '\r', '\n'}) {
		t.Fatal("mux boundary corrupted complete request terminator")
	}
}
