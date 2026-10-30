using UnityEngine;

namespace ChuaOnline.Gameplay
{

[RequireComponent(typeof(CharacterController))]
public sealed class ChibiPlayerController : MonoBehaviour
{
    [SerializeField] private float walkSpeed = 2.4f;
    [SerializeField] private float runSpeed = 4.8f;
    [SerializeField] private float rotationSpeed = 12f;
    [SerializeField] private Animator animator = null!;

    private CharacterController controller = null!;
    private Vector3 verticalVelocity;
    private int requestedPosture;

    public int CurrentPosture => requestedPosture;
    public bool IsGrounded => controller.isGrounded;

    public void SetPosture(int posture)
    {
        requestedPosture = Mathf.Clamp(posture, 0, 3);
        if (animator != null) animator.SetInteger("Posture", requestedPosture);
    }

    private void Awake()
    {
        controller = GetComponent<CharacterController>();
        if (animator == null) animator = GetComponentInChildren<Animator>();
    }

    private void Update()
    {
        var input = Application.isMobilePlatform ? MobileJoystick.InputValue : new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        var camera = Camera.main;
        var forward = camera ? Vector3.Scale(camera.transform.forward, new Vector3(1, 0, 1)).normalized : Vector3.forward;
        var right = camera ? camera.transform.right : Vector3.right;
        var direction = Vector3.ClampMagnitude(right * input.x + forward * input.y, 1f);
        var isMoving = direction.sqrMagnitude > 0.01f;
        var running = Input.GetKey(KeyCode.LeftShift) && isMoving;

        // Nếu di chuyển joystick/phím, tự động đứng dậy kinh hành
        if (isMoving)
        {
            requestedPosture = 0;
        }

        var posture = Application.isMobilePlatform ? requestedPosture :
                      Input.GetKey(KeyCode.C) ? 1 :
                      Input.GetKey(KeyCode.X) ? 2 :
                      Input.GetKey(KeyCode.Z) ? 3 : requestedPosture;

        if (posture == 0)
        {
            var speed = running ? runSpeed : walkSpeed;
            controller.Move(direction * (speed * Time.deltaTime));
            if (isMoving)
            {
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(direction), rotationSpeed * Time.deltaTime);
            }
        }

        if (controller.isGrounded && verticalVelocity.y < 0) verticalVelocity.y = -2f;
        verticalVelocity.y += Physics.gravity.y * Time.deltaTime;
        controller.Move(verticalVelocity * Time.deltaTime);

        if (animator != null)
        {
            var animSpeed = isMoving ? (running ? 2f : 1f) : 0f;
            animator.SetFloat("Speed", animSpeed, 0.1f, Time.deltaTime);
            animator.SetInteger("Posture", posture);
        }
    }
}
}
