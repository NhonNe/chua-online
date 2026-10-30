using System;
using System.IO;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Playables;
using UnityEngine.Animations;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using ChuaOnline.Gameplay;

namespace ChuaOnline.Editor
{

public static class TempleWorldBuilder
{
    private const string Root = "Assets/Prototype";
    private const string RenderingRoot = "Assets/Prototype/Rendering";
    private const string RendererPath = RenderingRoot + "/ChuaUniversalRenderer.asset";
    private const string PipelinePath = RenderingRoot + "/ChuaUniversalPipeline.asset";
    private static Material wood = null!, gold = null!, cream = null!, red = null!, stone = null!, green = null!, dark = null!, cushion = null!;

    [MenuItem("CHUA ONLINE/Build TempleWorld Prototype")]
    public static void Build()
    {
        EnsureFolders();
        ConfigureUrp();
        CreateMaterials();
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var world = new GameObject("TempleWorld");
        BuildGround(world.transform);
        BuildTemple(world.transform);
        BuildCourtyard(world.transform);
        BuildDecor(world.transform);
        var player = BuildPlayer(world.transform);
        BuildCrowd(player, world.transform);
        BuildCamera(player);
        BuildLighting(world.transform);
        BuildHud();
        BuildNetworkManager();
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.22f, .18f, .13f);
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/TempleWorld.unity");
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        ValidateAndRender();
        Debug.Log("CHUA ONLINE: TempleWorld prototype built successfully with enhanced chibi animations and cloud integration.");
    }

    private static void EnsureFolders()
    {
        foreach (var path in new[] { "Assets/Scenes", "Assets/Prototype", "Assets/Prototype/Materials", "Assets/Prototype/Animations", "Assets/Prototype/Prefabs", RenderingRoot, "Assets/Models", "Assets/Audio" })
            if (!AssetDatabase.IsValidFolder(path))
            {
                var parent = Path.GetDirectoryName(path)?.Replace('\\', '/') ?? "Assets";
                var name = Path.GetFileName(path);
                AssetDatabase.CreateFolder(parent, name);
            }
    }

    private static Material Mat(string name, Color color, float metallic = 0, float smoothness = .35f)
    {
        var assetPath = $"{Root}/Materials/{name}.mat";
        var existing = AssetDatabase.LoadAssetAtPath<Material>(assetPath);
        if (existing != null)
        {
            ConfigureMaterial(existing, color, metallic, smoothness);
            return existing;
        }
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) throw new InvalidOperationException("Universal Render Pipeline/Lit shader is unavailable.");
        var material = new Material(shader) { name = name };
        ConfigureMaterial(material, color, metallic, smoothness);
        AssetDatabase.CreateAsset(material, assetPath);
        return material;
    }

    private static void ConfigureMaterial(Material material, Color color, float metallic, float smoothness)
    {
        var lit = Shader.Find("Universal Render Pipeline/Lit");
        if (lit == null) throw new InvalidOperationException("Universal Render Pipeline/Lit shader is unavailable.");
        if (material.shader != lit) material.shader = lit;
        material.color = color;
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metallic);
        if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", smoothness);
        EditorUtility.SetDirty(material);
    }

    private static void ConfigureUrp()
    {
        var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
        if (pipeline == null)
        {
            var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                renderer.name = "ChuaUniversalRenderer";
                AssetDatabase.CreateAsset(renderer, RendererPath);
            }
            pipeline = UniversalRenderPipelineAsset.Create(renderer);
            pipeline.name = "ChuaUniversalPipeline";
            AssetDatabase.CreateAsset(pipeline, PipelinePath);
        }
        GraphicsSettings.defaultRenderPipeline = pipeline;
        QualitySettings.renderPipeline = pipeline;
        EditorUtility.SetDirty(pipeline);
        AssetDatabase.SaveAssets();
        Debug.Log($"CHUA ONLINE: URP pipeline assigned: {pipeline.name}, version 17.3.0 package.");
    }

    private static void CreateMaterials()
    {
        wood = Mat("TempleWood", new Color(.33f, .14f, .055f), 0, .25f);
        gold = Mat("BuddhaGold", new Color(1f, .55f, .08f), .6f, .65f);
        cream = Mat("ChibiCream", new Color(.95f, .78f, .46f));
        red = Mat("TempleRed", new Color(.42f, .035f, .025f));
        stone = Mat("CourtyardStone", new Color(.32f, .34f, .35f));
        green = Mat("GardenGreen", new Color(.08f, .28f, .12f));
        dark = Mat("DarkTrim", new Color(.07f, .025f, .015f));
        cushion = Mat("TempleCushion", new Color(.24f, .17f, .12f), 0, .15f);
    }

    private static GameObject Cube(string name, Transform parent, Vector3 position, Vector3 scale, Material material, float bevel = 0)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube); go.name = name; go.transform.SetParent(parent); go.transform.SetPositionAndRotation(position, Quaternion.identity); go.transform.localScale = scale; go.GetComponent<Renderer>().sharedMaterial = material; return go;
    }

    private static GameObject Cylinder(string name, Transform parent, Vector3 position, Vector3 scale, Material material)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder); go.name = name; go.transform.SetParent(parent); go.transform.SetPositionAndRotation(position, Quaternion.identity); go.transform.localScale = scale; go.GetComponent<Renderer>().sharedMaterial = material; return go;
    }

    private static GameObject Sphere(string name, Transform parent, Vector3 position, Vector3 scale, Material material)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Sphere); go.name = name; go.transform.SetParent(parent); go.transform.SetPositionAndRotation(position, Quaternion.identity); go.transform.localScale = scale; go.GetComponent<Renderer>().sharedMaterial = material; return go;
    }

    private static void BuildGround(Transform root)
    {
        var ground = Cube("TempleGround", root, new Vector3(0, -.35f, 3), new Vector3(42, .5f, 42), stone);
        ground.isStatic = true;
        Cube("WoodenProcessionalPath", root, new Vector3(0, -.02f, -4), new Vector3(7, .12f, 22), wood);
    }

    private static void BuildTemple(Transform root)
    {
        var hall = new GameObject("GreatHall").transform; hall.SetParent(root);
        Cube("HallBase", hall, new Vector3(0, .3f, 7), new Vector3(22, .6f, 15), wood);
        Cube("HallFloor", hall, new Vector3(0, .64f, 7), new Vector3(21.3f, .12f, 14.3f), Mat("FloorGold", new Color(.46f, .25f, .08f), 0, .5f));
        Cube("BackWall", hall, new Vector3(0, 6.2f, 14), new Vector3(22, 11, .5f), red);
        Cube("LeftWall", hall, new Vector3(-10.8f, 6.2f, 7), new Vector3(.5f, 11, 14), red);
        Cube("RightWall", hall, new Vector3(10.8f, 6.2f, 7), new Vector3(.5f, 11, 14), red);
        for (var x = -9; x <= 9; x += 3)
        {
            Cylinder("WoodColumn", hall, new Vector3(x, 4.4f, .6f), new Vector3(.35f, 4.4f, .35f), wood);
            Cylinder("WoodColumn", hall, new Vector3(x, 4.4f, 13.4f), new Vector3(.35f, 4.4f, .35f), wood);
        }
        Cube("RoofLower", hall, new Vector3(0, 11.4f, 7), new Vector3(24, .45f, 17), red);
        Cube("RoofUpper", hall, new Vector3(0, 12.2f, 7), new Vector3(19, .45f, 13), dark);
        Cube("RoofRidge", hall, new Vector3(0, 13f, 7), new Vector3(6, .35f, 1), gold);
        Cube("AltarTable", hall, new Vector3(0, 1.35f, 9.9f), new Vector3(6.2f, .45f, 1.4f), dark);
        Cube("AltarTop", hall, new Vector3(0, 1.7f, 9.9f), new Vector3(6.6f, .18f, 1.55f), wood);
        for (var x = -2; x <= 2; x += 2)
        {
            Cylinder("IncenseBowl", hall, new Vector3(x, 1.95f, 9.6f), new Vector3(.25f, .18f, .25f), gold);
            Sphere("Offering", hall, new Vector3(x, 2.25f, 9.6f), new Vector3(.18f, .12f, .18f), cream);
        }
        var buddha = new GameObject("GoldenBuddha").transform; buddha.SetParent(hall);
        Cylinder("BuddhaSeat", buddha, new Vector3(0, 1.3f, 11.8f), new Vector3(3.3f, .45f, 2.2f), gold);
        Sphere("BuddhaBody", buddha, new Vector3(0, 3.5f, 11.8f), new Vector3(2.5f, 3.2f, 1.5f), gold);
        Sphere("BuddhaHead", buddha, new Vector3(0, 6.5f, 11.8f), new Vector3(1.55f, 1.7f, 1.35f), gold);
        Cylinder("BuddhaHalo", buddha, new Vector3(0, 6.5f, 12.35f), new Vector3(2.2f, .15f, 2.2f), gold).transform.Rotate(90, 0, 0);
        for (var i = -1; i <= 1; i += 2) Sphere("BuddhaHand", buddha, new Vector3(i * 1.35f, 2.7f, 11.1f), new Vector3(.7f, .35f, .8f), gold);

        // 36 Bồ đoàn (6x6) cho Phật tử chiêm bái, tọa thiền
        var cushionsGroup = new GameObject("Cushions").transform; cushionsGroup.SetParent(hall);
        for (int row = 0; row < 6; row++)
        {
            for (int col = 0; col < 6; col++)
            {
                float posX = -3.75f + col * 1.5f;
                float posZ = 2.4f + row * 1.25f;
                var c = Cylinder($"Cushion_{row * 6 + col:00}", cushionsGroup, new Vector3(posX, 0.73f, posZ), new Vector3(0.85f, 0.10f, 0.85f), cushion);
            }
        }
    }

    private static void BuildCourtyard(Transform root)
    {
        var courtyard = new GameObject("Courtyard").transform; courtyard.SetParent(root);
        Cube("CourtyardPlatform", courtyard, new Vector3(0, .05f, -5), new Vector3(24, .16f, 12), stone);
        Cube("FrontSteps", courtyard, new Vector3(0, .35f, 1), new Vector3(14, .35f, 3), stone);
        for (var x = -9; x <= 9; x += 3)
        {
            Cylinder("LanternPost", courtyard, new Vector3(x, 1.1f, -7.5f), new Vector3(.16f, 1.1f, .16f), dark);
            Sphere("LanternGlow", courtyard, new Vector3(x, 2.35f, -7.5f), new Vector3(.42f, .65f, .42f), gold);
        }
    }

    private static void BuildDecor(Transform root)
    {
        var decor = new GameObject("TempleDecor").transform; decor.SetParent(root);
        for (var x = -18; x <= 18; x += 6)
        for (var z = -14; z <= 17; z += 7)
        {
            if (Mathf.Abs(x) < 12 && z > 0) continue;
            if (Mathf.Abs(x) < 9 && z < -7) continue;
            Cylinder("GardenTreeTrunk", decor, new Vector3(x, 1.2f, z), new Vector3(.25f, 1.2f, .25f), wood);
            Sphere("GardenCanopy", decor, new Vector3(x, 3f, z), new Vector3(1.5f, 1.8f, 1.5f), green);
        }
        for (var x = -8; x <= 8; x += 4)
        {
            var lamp = Sphere("WarmPendant", decor, new Vector3(x, 7.8f, 3f), new Vector3(.32f, .45f, .32f), gold);
            var light = lamp.AddComponent<Light>(); light.type = LightType.Point; light.range = 5; light.intensity = 2.4f; light.color = new Color(1f, .65f, .28f);
        }
    }

    private static GameObject BuildPlayer(Transform root)
    {
        var player = new GameObject("Player_Chibi"); player.transform.SetParent(root); player.transform.position = new Vector3(0, 1.1f, -10);
        var controller = player.AddComponent<CharacterController>(); controller.height = 2.1f; controller.radius = .45f; controller.center = new Vector3(0, 1.05f, 0);
        var visual = new GameObject("Armature_Chibi"); visual.transform.SetParent(player.transform); visual.transform.localPosition = Vector3.zero;
        var hips = new GameObject("Hips"); hips.transform.SetParent(visual.transform); hips.transform.localPosition = new Vector3(0, .9f, 0);
        var spine = new GameObject("Spine"); spine.transform.SetParent(hips.transform); spine.transform.localPosition = new Vector3(0, .55f, 0);
        var head = new GameObject("Head"); head.transform.SetParent(spine.transform); head.transform.localPosition = new Vector3(0, .9f, 0);
        var leftArm = new GameObject("LeftArm"); leftArm.transform.SetParent(spine.transform); leftArm.transform.localPosition = new Vector3(-.55f, .45f, 0);
        var rightArm = new GameObject("RightArm"); rightArm.transform.SetParent(spine.transform); rightArm.transform.localPosition = new Vector3(.55f, .45f, 0);
        var leftLeg = new GameObject("LeftLeg"); leftLeg.transform.SetParent(hips.transform); leftLeg.transform.localPosition = new Vector3(-.25f, -.65f, 0);
        var rightLeg = new GameObject("RightLeg"); rightLeg.transform.SetParent(hips.transform); rightLeg.transform.localPosition = new Vector3(.25f, -.65f, 0);
        Sphere("Body", spine.transform, new Vector3(0, .2f, 0), new Vector3(.85f, 1f, .55f), cream);
        Sphere("BigHead", head.transform, Vector3.zero, new Vector3(1.05f, 1.05f, 1.05f), cream);
        Cube("Robe", spine.transform, new Vector3(0, .05f, 0), new Vector3(1.05f, .8f, .7f), red);
        Cylinder("LegL", leftLeg.transform, Vector3.zero, new Vector3(.22f, .65f, .22f), cream);
        Cylinder("LegR", rightLeg.transform, Vector3.zero, new Vector3(.22f, .65f, .22f), cream);
        Sphere("HandL", leftArm.transform, Vector3.zero, new Vector3(.24f, .3f, .24f), cream);
        Sphere("HandR", rightArm.transform, Vector3.zero, new Vector3(.24f, .3f, .24f), cream);
        var animator = player.AddComponent<Animator>();
        var controllerAsset = CreateAnimatorController();
        animator.runtimeAnimatorController = controllerAsset;
        player.AddComponent<ChibiPlayerController>();
        var prefabPath = "Assets/Prototype/Prefabs/ChibiPlayer.prefab";
        PrefabUtility.SaveAsPrefabAsset(player, prefabPath);
        return player;
    }

    private static void BuildCrowd(GameObject player, Transform root)
    {
        var positions = new[]
        {
            new Vector3(-3.2f, 1.1f, -2.2f), new Vector3(-1.4f, 1.1f, -.5f), new Vector3(1.5f, 1.1f, .2f),
            new Vector3(3.2f, 1.1f, 1.5f), new Vector3(-4.2f, 1.1f, 2.5f), new Vector3(3.9f, 1.1f, 3.4f),
            new Vector3(-2.7f, 1.1f, 4.1f)
        };
        for (var i = 0; i < positions.Length; i++)
        {
            var clone = UnityEngine.Object.Instantiate(player, positions[i], Quaternion.identity, root);
            clone.name = $"ChibiCrowd_{i + 1:00}";
            var controller = clone.GetComponent<ChibiPlayerController>();
            if (controller != null) controller.enabled = false;
            var animator = clone.GetComponent<Animator>();
            if (animator != null) animator.Play("Idle", 0, (i % 3) * .12f);
        }
    }

    private static RuntimeAnimatorController CreateAnimatorController()
    {
        var path = "Assets/Prototype/Animations/ChibiAnimator.controller";
        var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(path);
        if (controller == null)
        {
            controller = AnimatorController.CreateAnimatorControllerAtPath(path);
            controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
            controller.AddParameter("Posture", AnimatorControllerParameterType.Int);
        }

        var clips = new[] {
            CreateClip("Idle", 1.8f),
            CreateClip("Walk", 0.65f),
            CreateClip("Run", 0.40f),
            CreateClip("Sit", 1.0f),
            CreateClip("Kneel", 1.0f),
            CreateClip("Bow", 2.2f)
        };
        foreach (var clip in clips)
        {
            var clipPath = $"Assets/Prototype/Animations/{clip.name}.anim";
            var existingClip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
            if (existingClip != null)
            {
                EditorUtility.CopySerialized(clip, existingClip);
            }
            else
            {
                AssetDatabase.CreateAsset(clip, clipPath);
            }
        }

        var sm = controller.layers[0].stateMachine;
        sm.states = Array.Empty<ChildAnimatorState>();
        var idle = sm.AddState("Idle"); idle.motion = clips[0];
        var walk = sm.AddState("Walk"); walk.motion = clips[1];
        var run = sm.AddState("Run"); run.motion = clips[2];
        var sit = sm.AddState("Sit"); sit.motion = clips[3];
        var kneel = sm.AddState("Kneel"); kneel.motion = clips[4];
        var bow = sm.AddState("Bow"); bow.motion = clips[5];

        var idleToWalk = idle.AddTransition(walk); idleToWalk.AddCondition(AnimatorConditionMode.Greater, .1f, "Speed"); idleToWalk.hasExitTime = false;
        var walkToIdle = walk.AddTransition(idle); walkToIdle.AddCondition(AnimatorConditionMode.Less, .1f, "Speed"); walkToIdle.hasExitTime = false;
        var walkToRun = walk.AddTransition(run); walkToRun.AddCondition(AnimatorConditionMode.Greater, 1.5f, "Speed"); walkToRun.hasExitTime = false;
        var runToWalk = run.AddTransition(walk); runToWalk.AddCondition(AnimatorConditionMode.Less, 1.5f, "Speed"); runToWalk.hasExitTime = false;
        foreach (var state in new[] { idle, walk, run })
        {
            var toSit = state.AddTransition(sit); toSit.AddCondition(AnimatorConditionMode.Equals, 1, "Posture"); toSit.hasExitTime = false;
            var toKneel = state.AddTransition(kneel); toKneel.AddCondition(AnimatorConditionMode.Equals, 2, "Posture"); toKneel.hasExitTime = false;
            var toBow = state.AddTransition(bow); toBow.AddCondition(AnimatorConditionMode.Equals, 3, "Posture"); toBow.hasExitTime = false;
        }
        foreach (var state in new[] { sit, kneel, bow })
        {
            var back = state.AddTransition(idle); back.AddCondition(AnimatorConditionMode.Equals, 0, "Posture"); back.hasExitTime = false;
        }

        EditorUtility.SetDirty(controller);
        return controller;
    }

    private static AnimationClip CreateClip(string name, float length)
    {
        var clip = new AnimationClip { name = name, legacy = false, wrapMode = WrapMode.Loop };
        clip.frameRate = 30;

        if (name == "Walk")
        {
            // Bước đi Chibi Kinh Hành tự nhiên, lắc lư hông và vung tay
            clip.SetCurve("Armature_Chibi/Hips/LeftLeg", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, -22f));
            clip.SetCurve("Armature_Chibi/Hips/RightLeg", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 22f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 18f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, -18f));
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", BobbingCurve(length, .90f, .04f));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.z", SineCurve(length, 4f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/Head", typeof(Transform), "localEulerAnglesRaw.z", SineCurve(length, -3f));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 4f));
        }
        else if (name == "Run")
        {
            // Chạy nhanh chibi vui nhộn
            clip.SetCurve("Armature_Chibi/Hips/LeftLeg", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, -34f));
            clip.SetCurve("Armature_Chibi/Hips/RightLeg", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 34f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 28f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, -28f));
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", BobbingCurve(length, .90f, .07f));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.z", SineCurve(length, 6f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/Head", typeof(Transform), "localEulerAnglesRaw.z", SineCurve(length, -4.5f));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 8f));
        }
        else if (name == "Idle")
        {
            // Đứng tịnh tâm, nhịp thở tĩnh lặng
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 2f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/Head", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, -1.5f));
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", Curve(length, .90f, .91f, .90f));
        }
        else if (name == "Sit")
        {
            // Tọa thiền tĩnh tâm trên bồ đoàn
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", ConstantCurve(length, .42f));
            clip.SetCurve("Armature_Chibi/Hips/LeftLeg", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 85f));
            clip.SetCurve("Armature_Chibi/Hips/RightLeg", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 85f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.z", ConstantCurve(length, 24f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 28f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.z", ConstantCurve(length, -24f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 28f));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.x", SineCurve(length, 1.2f));
        }
        else if (name == "Kneel")
        {
            // Quỳ chắp tay đảnh lễ (Gassho)
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", ConstantCurve(length, .50f));
            clip.SetCurve("Armature_Chibi/Hips/LeftLeg", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 75f));
            clip.SetCurve("Armature_Chibi/Hips/RightLeg", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 75f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.z", ConstantCurve(length, 38f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.y", ConstantCurve(length, -30f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.z", ConstantCurve(length, -38f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.y", ConstantCurve(length, 30f));
            clip.SetCurve("Armature_Chibi/Hips/Spine/Head", typeof(Transform), "localEulerAnglesRaw.x", ConstantCurve(length, 8f));
        }
        else if (name == "Bow")
        {
            // Lạy Phật ngũ thể đầu địa
            clip.SetCurve("Armature_Chibi/Hips", typeof(Transform), "localPosition.y", MultiCurve(length, new[] { .90f, .50f, .32f, .50f, .90f }));
            clip.SetCurve("Armature_Chibi/Hips/Spine", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 32f, 65f, 32f, 0f }));
            clip.SetCurve("Armature_Chibi/Hips/Spine/Head", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 22f, 45f, 22f, 0f }));
            clip.SetCurve("Armature_Chibi/Hips/LeftLeg", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 45f, 85f, 45f, 0f }));
            clip.SetCurve("Armature_Chibi/Hips/RightLeg", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 45f, 85f, 45f, 0f }));
            clip.SetCurve("Armature_Chibi/Hips/Spine/LeftArm", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 40f, 75f, 40f, 0f }));
            clip.SetCurve("Armature_Chibi/Hips/Spine/RightArm", typeof(Transform), "localEulerAnglesRaw.x", MultiCurve(length, new[] { 0f, 40f, 75f, 40f, 0f }));
        }

        return clip;
    }

    private static AnimationCurve SineCurve(float length, float amplitude, float phaseOffset = 0f, int steps = 16)
    {
        var keys = new Keyframe[steps + 1];
        for (int i = 0; i <= steps; i++)
        {
            float t = (float)i / steps * length;
            float val = Mathf.Sin((float)i / steps * Mathf.PI * 2f + phaseOffset) * amplitude;
            keys[i] = new Keyframe(t, val);
        }
        var curve = new AnimationCurve(keys);
        for (int i = 0; i <= steps; i++) curve.SmoothTangents(i, 0f);
        return curve;
    }

    private static AnimationCurve BobbingCurve(float length, float baseVal, float dipAmount, int steps = 16)
    {
        var keys = new Keyframe[steps + 1];
        for (int i = 0; i <= steps; i++)
        {
            float t = (float)i / steps * length;
            float val = baseVal - Mathf.Abs(Mathf.Sin((float)i / steps * Mathf.PI * 2f)) * dipAmount;
            keys[i] = new Keyframe(t, val);
        }
        var curve = new AnimationCurve(keys);
        for (int i = 0; i <= steps; i++) curve.SmoothTangents(i, 0f);
        return curve;
    }

    private static AnimationCurve ConstantCurve(float length, float val)
    {
        return new AnimationCurve(new Keyframe(0, val), new Keyframe(length, val));
    }

    private static AnimationCurve MultiCurve(float length, float[] points)
    {
        var keys = new Keyframe[points.Length];
        for (int i = 0; i < points.Length; i++)
        {
            float t = (float)i / (points.Length - 1) * length;
            keys[i] = new Keyframe(t, points[i]);
        }
        var curve = new AnimationCurve(keys);
        for (int i = 0; i < points.Length; i++) curve.SmoothTangents(i, 0f);
        return curve;
    }

    private static AnimationCurve Curve(float length, float start, float middle, float end)
    {
        return new AnimationCurve(new Keyframe(0, start), new Keyframe(length * .5f, middle), new Keyframe(length, end));
    }

    private static void BuildCamera(GameObject player)
    {
        var camera = new GameObject("Main Camera"); camera.tag = "MainCamera"; camera.transform.position = new Vector3(0, 4, -17);
        var controller = camera.AddComponent<ThirdPersonCamera>(); controller.SetTarget(player.transform); var cam = camera.AddComponent<Camera>(); cam.fieldOfView = 58; cam.nearClipPlane = .1f; cam.farClipPlane = 100;
        camera.transform.LookAt(player.transform.position + Vector3.up * 1.2f);
    }

    private static void BuildLighting(Transform root)
    {
        var lightGo = new GameObject("WarmSun"); lightGo.transform.SetParent(root); var sun = lightGo.AddComponent<Light>(); sun.type = LightType.Directional; sun.intensity = 1.1f; sun.color = new Color(1f, .72f, .48f); lightGo.transform.rotation = Quaternion.Euler(42, -28, 0);
    }

    private static void BuildHud()
    {
        var hud = new GameObject("PrototypeHUD");
        hud.AddComponent<ChuaOnline.UI.PrototypeHud>();
    }

    private static void BuildNetworkManager()
    {
        var net = new GameObject("NetworkManager");
        net.AddComponent<TempleNetworkClient>();
    }

    private static void ValidateAndRender()
    {
        var materials = AssetDatabase.FindAssets("t:Material", new[] { Root + "/Materials" });
        var fixedCount = 0;
        var missingShaders = 0;
        foreach (var guid in materials)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null) continue;
            var before = material.shader == null ? "<missing>" : material.shader.name;
            if (material.shader == null || before != "Universal Render Pipeline/Lit")
            {
                ConfigureMaterial(material, material.HasProperty("_BaseColor") ? material.GetColor("_BaseColor") : Color.white, material.HasProperty("_Metallic") ? material.GetFloat("_Metallic") : 0, material.HasProperty("_Smoothness") ? material.GetFloat("_Smoothness") : .35f);
                fixedCount++;
            }
            if (material.shader == null) missingShaders++;
            Debug.Log($"CHUA ONLINE: material {path}: {before} -> {material.shader?.name ?? "<missing>"}");
        }

        var renderers = UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None);
        var invalidRefs = 0;
        foreach (var renderer in renderers)
            foreach (var mat in renderer.sharedMaterials)
                if (mat == null || mat.shader == null || mat.shader.name == "Hidden/InternalErrorShader") invalidRefs++;
        Debug.Log($"CHUA ONLINE: materials validated (fixed: {fixedCount}, missing shaders: {missingShaders}, invalid renderer refs: {invalidRefs}).");
    }
}
}
