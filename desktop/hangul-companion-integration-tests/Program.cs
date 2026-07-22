using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text.Json;
using System.Windows.Forms;

namespace Academy.HangulCompanion.IntegrationTests;

internal static class Program
{
    private const int RotFlagsRegistrationKeepsAlive = 1;

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 3 && args[0].Equals("--serve", StringComparison.OrdinalIgnoreCase))
            return ServeMockHangul(args[1], args[2]);
        if (args.Length == 2 && args[0].Equals("--probe-rot", StringComparison.OrdinalIgnoreCase))
        {
            var (inserted, reason) = InvokeInsert(Path.GetFullPath(args[1]));
            Console.WriteLine(JsonSerializer.Serialize(new { inserted, reason }));
            return inserted ? 0 : 1;
        }

        var tempRoot = Path.Combine(Path.GetTempPath(), "Academy", "HangulCompanionIntegration", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        var hwpxPath = Path.Combine(tempRoot, "검수본.hwpx");
        File.WriteAllText(hwpxPath, "Academy Hangul companion COM integration fixture");

        try
        {
            TestInsertContract(hwpxPath);
            TestApprovedPathModule(hwpxPath);
            TestRejectedInsert(hwpxPath);
            TestOnlyVisibleEditableDocumentIsSelected(hwpxPath);
            TestCrossProcessRot(hwpxPath, tempRoot);
            Console.WriteLine("Hangul companion Windows COM integration tests passed.");
            return 0;
        }
        finally
        {
            Environment.SetEnvironmentVariable("ACADEMY_HWP_FILE_PATH_MODULE", null);
            Directory.Delete(tempRoot, recursive: true);
        }
    }

    private static void TestCrossProcessRot(string hwpxPath, string tempRoot)
    {
        var evidencePath = Path.Combine(tempRoot, "cross-process-evidence.json");
        var readyPath = Path.Combine(tempRoot, "cross-process-ready.txt");
        using var server = StartCurrentProcess("--serve", evidencePath, readyPath);
        try
        {
            Assert(SpinWait.SpinUntil(() => File.Exists(readyPath), TimeSpan.FromSeconds(15)),
                "cross-process mock Hangul server did not become ready");
            using var probe = StartCurrentProcess("--probe-rot", hwpxPath);
            Assert(probe.WaitForExit(15_000), "cross-process companion probe timed out");
            Assert(probe.ExitCode == 0, "cross-process companion probe rejected the mock Hangul document");
            Assert(server.WaitForExit(15_000), "cross-process mock Hangul server did not stop after insertion");
            Assert(server.ExitCode == 0, "cross-process mock Hangul server did not record insertion");

            using var evidence = JsonDocument.Parse(File.ReadAllText(evidencePath));
            var root = evidence.RootElement;
            Assert(root.GetProperty("create_action_names")[0].GetString() == "InsertFile",
                "cross-process call must select InsertFile");
            Assert(root.GetProperty("execute_calls").GetInt32() == 1,
                "cross-process InsertFile must execute exactly once");
            Assert(root.GetProperty("parameters").GetProperty("FileName").GetString() == hwpxPath,
                "cross-process FileName must preserve the extracted HWPX path");
            Assert(root.GetProperty("save_calls").GetInt32() == 0
                && root.GetProperty("close_calls").GetInt32() == 0
                && root.GetProperty("quit_calls").GetInt32() == 0,
                "cross-process insertion must never save, close, or quit Hangul");
        }
        finally
        {
            if (!server.HasExited) server.Kill(entireProcessTree: true);
        }
    }

    private static Process StartCurrentProcess(params string[] arguments)
    {
        var processPath = Environment.ProcessPath
            ?? throw new InvalidOperationException("Integration test executable path is unavailable.");
        var startInfo = new ProcessStartInfo
        {
            FileName = processPath,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        if (Path.GetFileNameWithoutExtension(processPath).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            startInfo.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        return Process.Start(startInfo)
            ?? throw new InvalidOperationException("Integration test child process did not start.");
    }

    private static int ServeMockHangul(string rawEvidencePath, string rawReadyPath)
    {
        var evidencePath = Path.GetFullPath(rawEvidencePath);
        var readyPath = Path.GetFullPath(rawReadyPath);
        Directory.CreateDirectory(Path.GetDirectoryName(evidencePath)!);
        Directory.CreateDirectory(Path.GetDirectoryName(readyPath)!);

        using var insertionCompleted = new ManualResetEventSlim(false);
        MockHwpObject? hwp = null;
        hwp = new MockHwpObject(
            visible: true,
            editMode: 1,
            executeResult: true,
            onExecute: parameterSet =>
            {
                var evidence = new
                {
                    process_id = Environment.ProcessId,
                    inserted_at_utc = DateTime.UtcNow,
                    create_action_names = hwp!.CreateActionNames,
                    create_set_calls = hwp.Action.CreateSetCalls,
                    get_default_calls = hwp.Action.GetDefaultCalls,
                    execute_calls = hwp.Action.ExecuteCalls,
                    parameters = hwp.Action.ParameterSet.Items,
                    register_module_calls = hwp.RegisterModuleCalls.Select(item => new
                    {
                        category = item.Category,
                        name = item.Name,
                    }),
                    save_calls = hwp.SaveCalls,
                    close_calls = hwp.CloseCalls,
                    quit_calls = hwp.QuitCalls,
                };
                File.WriteAllText(evidencePath, JsonSerializer.Serialize(evidence, new JsonSerializerOptions
                {
                    WriteIndented = true,
                }));
                insertionCompleted.Set();
            });

        using var registration = RotRegistration.RegisterHwp(hwp);
        File.WriteAllText(readyPath, Environment.ProcessId.ToString());
        var deadline = DateTime.UtcNow.AddSeconds(120);
        using var completionPoll = new System.Windows.Forms.Timer { Interval = 100 };
        completionPoll.Tick += (_, _) =>
        {
            if (insertionCompleted.IsSet || DateTime.UtcNow >= deadline) Application.ExitThread();
        };
        completionPoll.Start();
        Application.Run();
        return File.Exists(evidencePath) ? 0 : 1;
    }

    private static void TestInsertContract(string hwpxPath)
    {
        Environment.SetEnvironmentVariable("ACADEMY_HWP_FILE_PATH_MODULE", null);
        var hwp = new MockHwpObject(visible: true, editMode: 1, executeResult: true);
        using var registration = RotRegistration.RegisterHwp(hwp);

        var (inserted, reason) = InvokeInsert(hwpxPath);

        Assert(inserted, $"visible editable document should accept insertion: {reason}");
        Assert(reason == "", "successful insertion should not return a reason");
        Assert(hwp.CreateActionNames.SequenceEqual(["InsertFile"]), "InsertFile action must be selected exactly once");
        Assert(hwp.Action.CreateSetCalls == 1, "InsertFile parameter set must be created exactly once");
        Assert(hwp.Action.GetDefaultCalls == 1, "InsertFile defaults must be loaded exactly once");
        Assert(hwp.Action.ExecuteCalls == 1, "InsertFile must execute exactly once");
        Assert(hwp.Action.ParameterSet.Items.Count == 5, "InsertFile must receive exactly five controlled parameters");
        Assert((string)hwp.Action.ParameterSet.Items["FileName"] == hwpxPath, "FileName must be the extracted HWPX path");
        Assert((int)hwp.Action.ParameterSet.Items["KeepSection"] == 0, "KeepSection must be disabled");
        Assert((int)hwp.Action.ParameterSet.Items["KeepCharshape"] == 0, "KeepCharshape must be disabled");
        Assert((int)hwp.Action.ParameterSet.Items["KeepParashape"] == 0, "KeepParashape must be disabled");
        Assert((int)hwp.Action.ParameterSet.Items["KeepStyle"] == 0, "KeepStyle must be disabled");
        Assert(hwp.RegisterModuleCalls.Count == 0, "path module must not be registered when it is not configured");
        Assert(hwp.SaveCalls == 0 && hwp.CloseCalls == 0 && hwp.QuitCalls == 0,
            "companion must never save, close, or quit the user's Hangul document");
    }

    private static void TestApprovedPathModule(string hwpxPath)
    {
        const string moduleName = "AcademyFilePathCheck";
        Environment.SetEnvironmentVariable("ACADEMY_HWP_FILE_PATH_MODULE", moduleName);
        var hwp = new MockHwpObject(visible: true, editMode: 1, executeResult: true);
        using var registration = RotRegistration.RegisterHwp(hwp);

        var (inserted, reason) = InvokeInsert(hwpxPath);

        Assert(inserted, $"configured path module should preserve insertion: {reason}");
        Assert(hwp.RegisterModuleCalls.SequenceEqual([("FilePathCheckDLL", moduleName)]),
            "approved file-path module must be registered with Hancom's exact module category");
        Assert(hwp.SaveCalls == 0 && hwp.CloseCalls == 0 && hwp.QuitCalls == 0,
            "path-module insertion must remain non-destructive");
        Environment.SetEnvironmentVariable("ACADEMY_HWP_FILE_PATH_MODULE", null);
    }

    private static void TestRejectedInsert(string hwpxPath)
    {
        var hwp = new MockHwpObject(visible: true, editMode: 1, executeResult: false);
        using var registration = RotRegistration.RegisterHwp(hwp);

        var (inserted, reason) = InvokeInsert(hwpxPath);

        Assert(!inserted, "Hancom action rejection must not be reported as success");
        Assert(reason == "한글이 파일 삽입을 허용하지 않았습니다.", "action rejection must return the safe fallback reason");
        Assert(hwp.Action.ExecuteCalls == 1, "rejected InsertFile action must execute only once");
        Assert(hwp.SaveCalls == 0 && hwp.CloseCalls == 0 && hwp.QuitCalls == 0,
            "rejected insertion must not mutate document lifecycle");
    }

    private static void TestOnlyVisibleEditableDocumentIsSelected(string hwpxPath)
    {
        var hidden = new MockHwpObject(visible: false, editMode: 1, executeResult: true);
        var readOnly = new MockHwpObject(visible: true, editMode: 0, executeResult: true);
        using var hiddenRegistration = RotRegistration.RegisterHwp(hidden);
        using var readOnlyRegistration = RotRegistration.RegisterHwp(readOnly);

        var (inserted, reason) = InvokeInsert(hwpxPath);

        Assert(!inserted, "hidden and read-only documents must not receive insertion");
        Assert(reason == "열려 있는 일반 편집 모드의 한글 문서를 찾지 못했습니다.",
            "missing editable document must return the safe fallback reason");
        Assert(hidden.CreateActionNames.Count == 0 && readOnly.CreateActionNames.Count == 0,
            "ineligible documents must never create an InsertFile action");
        Assert(hidden.SaveCalls == 0 && hidden.CloseCalls == 0 && hidden.QuitCalls == 0,
            "hidden document lifecycle must not be touched");
        Assert(readOnly.SaveCalls == 0 && readOnly.CloseCalls == 0 && readOnly.QuitCalls == 0,
            "read-only document lifecycle must not be touched");
    }

    private static (bool Inserted, string Reason) InvokeInsert(string hwpxPath)
    {
        var assembly = Assembly.Load("Academy.HangulCompanion");
        var programType = assembly.GetType("Academy.HangulCompanion.Program", throwOnError: true)!;
        var method = programType.GetMethod("TryInsertIntoVisibleEditableHangul", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("Companion insertion entrypoint was not found.");
        object?[] arguments = [hwpxPath, null];
        var inserted = (bool)(method.Invoke(null, arguments)
            ?? throw new InvalidOperationException("Companion insertion entrypoint returned no result."));
        return (inserted, arguments[1] as string ?? "");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    [DllImport("ole32.dll", CharSet = CharSet.Unicode)]
    private static extern int CreateItemMoniker(string delimiter, string item, out IMoniker moniker);

    [DllImport("ole32.dll")]
    private static extern int GetRunningObjectTable(int reserved, out IRunningObjectTable runningObjectTable);

    private sealed class RotRegistration : IDisposable
    {
        private readonly IRunningObjectTable _runningObjectTable;
        private readonly IMoniker _moniker;
        private readonly int _cookie;

        private RotRegistration(IRunningObjectTable runningObjectTable, IMoniker moniker, int cookie)
        {
            _runningObjectTable = runningObjectTable;
            _moniker = moniker;
            _cookie = cookie;
        }

        public static RotRegistration RegisterHwp(MockHwpObject hwp)
        {
            Marshal.ThrowExceptionForHR(GetRunningObjectTable(0, out var runningObjectTable));
            Marshal.ThrowExceptionForHR(CreateItemMoniker(
                "!", $"HwpObject.Academy.Integration.{Guid.NewGuid():N}", out var moniker));
            var cookie = runningObjectTable.Register(RotFlagsRegistrationKeepsAlive, hwp, moniker);
            return new RotRegistration(runningObjectTable, moniker, cookie);
        }

        public void Dispose()
        {
            _runningObjectTable.Revoke(_cookie);
            if (Marshal.IsComObject(_moniker)) Marshal.FinalReleaseComObject(_moniker);
        }
    }
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockHwpObject
{
    public MockHwpObject(
        bool visible,
        int editMode,
        bool executeResult,
        Action<MockParameterSet>? onExecute = null)
    {
        XHwpWindows = new MockHwpWindows(visible);
        XHwpDocuments = new MockHwpDocuments(editMode);
        Action = new MockAction(executeResult, onExecute);
    }

    public MockHwpWindows XHwpWindows { get; }
    public MockHwpDocuments XHwpDocuments { get; }
    public MockAction Action { get; }
    public List<string> CreateActionNames { get; } = [];
    public List<(string Category, string Name)> RegisterModuleCalls { get; } = [];
    public int SaveCalls { get; private set; }
    public int CloseCalls { get; private set; }
    public int QuitCalls { get; private set; }

    public bool RegisterModule(string category, string name)
    {
        RegisterModuleCalls.Add((category, name));
        return true;
    }

    public MockAction CreateAction(string name)
    {
        CreateActionNames.Add(name);
        return Action;
    }

    public void Save() => SaveCalls++;
    public void Close() => CloseCalls++;
    public void Quit() => QuitCalls++;
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockHwpWindows(bool visible)
{
    public MockHwpWindow Active_XHwpWindow { get; } = new(visible);
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockHwpWindow(bool visible)
{
    public bool Visible { get; } = visible;
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockHwpDocuments(int editMode)
{
    public MockHwpDocument Active_XHwpDocument { get; } = new(editMode);
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockHwpDocument(int editMode)
{
    public int EditMode { get; } = editMode;
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockAction
{
    private readonly bool _executeResult;
    private readonly Action<MockParameterSet>? _onExecute;

    public MockAction(bool executeResult, Action<MockParameterSet>? onExecute)
    {
        _executeResult = executeResult;
        _onExecute = onExecute;
    }

    public MockParameterSet ParameterSet { get; } = new();
    public int CreateSetCalls { get; private set; }
    public int GetDefaultCalls { get; private set; }
    public int ExecuteCalls { get; private set; }

    public MockParameterSet CreateSet()
    {
        CreateSetCalls++;
        return ParameterSet;
    }

    public void GetDefault(MockParameterSet parameterSet)
    {
        AssertSameSet(parameterSet);
        GetDefaultCalls++;
    }

    public bool Execute(MockParameterSet parameterSet)
    {
        AssertSameSet(parameterSet);
        ExecuteCalls++;
        _onExecute?.Invoke(parameterSet);
        return _executeResult;
    }

    private void AssertSameSet(MockParameterSet parameterSet)
    {
        if (!ReferenceEquals(parameterSet, ParameterSet))
            throw new InvalidOperationException("InsertFile action received an unexpected parameter set.");
    }
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class MockParameterSet
{
    public Dictionary<string, object> Items { get; } = new(StringComparer.Ordinal);

    public void SetItem(string name, object value)
    {
        if (!Items.TryAdd(name, value))
            throw new InvalidOperationException($"InsertFile parameter was assigned more than once: {name}");
    }
}
