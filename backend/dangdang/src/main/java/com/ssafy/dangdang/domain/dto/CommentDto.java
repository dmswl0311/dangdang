package com.ssafy.dangdang.domain.dto;

import com.ssafy.dangdang.domain.Comment;
import com.ssafy.dangdang.domain.types.CommentType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class CommentDto {

    private String id;
    private String content;
    private Long referenceId;
    private CommentType commentType;
    private Integer depth;
    private Long writerId;
    private String writerNickname;
    private String writerEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt ;

    private List<CommentDto> children;
    private String parentId;

    public static CommentDto of(Comment comment){
        if (comment.getChildren() != null){
            List<Comment> children = comment.getChildren();
            List<CommentDto> commentDtos = children.stream().map(child -> CommentDto.of(child))
                    .collect(Collectors.toList());
            return CommentDto.builder()
                    .id(comment.getId())
                    .content(comment.getContent())
                    .depth(comment.getDepth())
                    .createdAt(comment.getCreatedAt())
                    .updatedAt(comment.getUpdatedAt())
                    .referenceId(comment.getReferenceId())
                    .commentType(comment.getCommentType())
                    .writerId(comment.getWriterId())
                    .writerEmail(comment.getWriterEmail())
                    .writerNickname(comment.getWriterNickname())
                    .children(commentDtos)
                    .build();
        }
        else
            return CommentDto.builder()
                    .id(comment.getId())
                    .content(comment.getContent())
                    .depth(comment.getDepth())
                    .createdAt(comment.getCreatedAt())
                    .updatedAt(comment.getUpdatedAt())
                    .referenceId(comment.getReferenceId())
                    .commentType(comment.getCommentType())
                    .writerId(comment.getWriterId())
                    .writerEmail(comment.getWriterEmail())
                    .writerNickname(comment.getWriterNickname())
                    .build();
    }


}
